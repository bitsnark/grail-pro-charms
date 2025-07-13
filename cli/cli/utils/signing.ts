import { schnorr } from "@noble/curves/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { BitcoinClient } from "../../core/bitcoin";
import { KeyPair, generateSpendingScriptForGrail, generateSpendingScriptsForUser } from "../../core/taproot";
import { GrailState, LabeledSignature, Spell, UserPaymentDetails } from "../../core/types";
import { getHash, Network } from "../../core/taproot/taproot-common";
import { showSpell } from "../../core/charms-sdk";

export function txidToHash(txid: string): Buffer {
  return Buffer.from(txid, 'hex').reverse();
}

export function hashToTxid(hash: Buffer): string {
  // This is a hack to avoid Buffer.reverse() which behaves unexpectedly
  return Buffer.from(Array.from(hash).reverse()).toString('hex');
}

export function txBytesToTxid(txBytes: Buffer): string {
  return bitcoin.Transaction.fromBuffer(txBytes).getId();
}

export function txHexToTxid(txHex: string): string {
  const txBytes = Buffer.from(txHex, 'hex');
  return txBytesToTxid(txBytes);
}

export async function getStateFromNft(nftTxId: string): Promise<{ publicKeys: string[], threshold: number }> {

  const bitcoinClient = await BitcoinClient.create();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(nftTxId);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${nftTxId} not found`);
  }

  const previousSpellData = await showSpell(previousNftTxhex);
  console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  return {
    publicKeys: previousPublicKeys,
    threshold: previousThreshold
  };
}

async function signTransactionInput(
  txBytes: Buffer,
  inputIndex: number,
  script: Buffer,
  previousTxBytesMap: { [txid: string]: Buffer },
  keyPairs: KeyPair[],
  threshold: number): Promise<LabeledSignature[]> {

  if (keyPairs.length < threshold) {
    throw new Error(`Not enough key pairs provided. Required: ${threshold}, provided: ${keyPairs.length}`);
  }

  const bitcoinClient = await BitcoinClient.create();

  // Load the transaction to sign
  const tx = bitcoin.Transaction.fromBuffer(txBytes);

  // SIGHASH type for Taproot (BIP-342)
  const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT || 0x00;

  // Tapleaf version for tapscript is always 0xc0
  // BitcoinJS v6+ exposes tapleafHash for this calculation
  const tapleafHash = getHash(script);

  const previous: { value: number, script: Buffer }[] = [];
  for (const input of tx.ins) {
    let ttxBytes: Buffer;
    const inputTxid = hashToTxid(input.hash);
    if (previousTxBytesMap[inputTxid]) {
      ttxBytes = previousTxBytesMap[inputTxid];
    } else {
      const ttxHex = await bitcoinClient.getTransactionHex(inputTxid);
      if (!ttxHex) {
        throw new Error(`Input transaction ${inputTxid} not found`);
      }
      ttxBytes = Buffer.from(ttxHex, 'hex');
    }
    const ttx = bitcoin.Transaction.fromBuffer(ttxBytes);
    const out = ttx.outs[input.index];
    previous.push({
      value: out.value,
      script: out.script
    });
  }

  // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
  const sighash = tx.hashForWitnessV1(
    inputIndex,
    previous.map(p => p.script),
    previous.map(p => p.value),
    sighashType,
    tapleafHash
  );

  // We only need threshold signatures, so we can ignore the rest
  const requiredKeypairs = keyPairs.slice(0, threshold);

  return requiredKeypairs.map(({ publicKey, privateKey }) => {
    const sig = schnorr.sign(sighash, privateKey);
    return {
      publicKey: publicKey.toString('hex'),
      signature: Buffer.from(sig),
    } as LabeledSignature;
  });
}

export async function grailSignSpellTransaction(
  spell: Spell,
  grailState: GrailState,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptForGrail(grailState, network);

  return signTransactionInput(
    spell.spellTxBytes,
    0,
    spendingScript.script,
    { [txBytesToTxid(spell.commitmentTxBytes)]: spell.commitmentTxBytes },
    keyPairs,
    grailState.threshold
  );
}

export async function grailSignCommitmentTransaction(
  commitmentTxBytes: Buffer,
  grailState: GrailState,
  userPaymentDetails: UserPaymentDetails,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptsForUser(grailState, userPaymentDetails, network);

  return signTransactionInput(
    commitmentTxBytes,
    1, // Assuming we are signing the second input (the user payment input)
    spendingScript.grail.script,
    {},
    keyPairs,
    grailState.threshold
  );
}

export function injectGrailSignaturesIntoTxInput(
  txBytes: Buffer,
  inputIndex: number,
  script: Buffer,
  controlBlock: Buffer,
  grailState: GrailState,
  signatures: LabeledSignature[]
): Buffer {

  if (signatures.length != grailState.threshold) {
    throw new Error(`Wrong number of signatures provided. Required: ${grailState.threshold}, provided: ${signatures.length}`);
  }

  if (signatures.some(sig => !grailState.publicKeys.includes(sig.publicKey))) {
    throw new Error(`Some signatures do not match the provided public keys.`);
  }

  // Order the signagures by public key to ensure deterministic ordering
  // leave 0 where missing signatures
  const map: { [key: string]: string } = {};
  signatures.forEach(sig => {
    map[sig.publicKey] = sig.signature.toString('hex');
  });
  const signaturesOrdered = grailState.publicKeys.map(pk => map[pk] || '');

  // Load the transaction to sign
  const tx = bitcoin.Transaction.fromBuffer(txBytes);

  // Witness: [signatures] [tapleaf script] [control block]
  tx.setWitness(inputIndex, [
    ...signaturesOrdered.map(sig => Buffer.from(sig, 'hex')),
    script,
    controlBlock
  ]);

  return tx.toBuffer();
}

export async function prepareSpell(
  spell: Spell,
  grailState: GrailState,
  userPaymentDetails: UserPaymentDetails | null,
  keyPairs: KeyPair[],
  network: Network): Promise<Spell> {

  let signedCommitmentTxBytes = spell.commitmentTxBytes;

  if (userPaymentDetails) {

    const commitmentSignatures = await grailSignCommitmentTransaction(
      spell.commitmentTxBytes,
      grailState,
      userPaymentDetails,
      keyPairs,
      network
    );
    const commitmentSpendingScript = generateSpendingScriptsForUser(grailState, userPaymentDetails, network);
    signedCommitmentTxBytes = injectGrailSignaturesIntoTxInput(
      spell.commitmentTxBytes,
      1,
      commitmentSpendingScript.grail.script,
      commitmentSpendingScript.grail.controlBlock,
      grailState,
      commitmentSignatures,
    );
    spell.commitmentTxBytes = signedCommitmentTxBytes;
  }

  // Make sure the last input of the spell transaction is the commitment transaction
  const commitmentTxid = txBytesToTxid(signedCommitmentTxBytes);
  const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
  spellTx.ins[spellTx.ins.length - 1].hash = txidToHash(commitmentTxid);
  spell.spellTxBytes = spellTx.toBuffer();

  const grailSignatures = await grailSignSpellTransaction(
    spell,
    grailState,
    keyPairs,
    network
  );

  const spellSpendingScript = generateSpendingScriptForGrail(grailState, network);
  const signedSpellTxBytes = injectGrailSignaturesIntoTxInput(
    spell.commitmentTxBytes,
    0,
    spellSpendingScript.script,
    spellSpendingScript.controlBlock,
    grailState,
    grailSignatures
  );

  return { commitmentTxBytes: signedCommitmentTxBytes, spellTxBytes: signedSpellTxBytes };
}