import { schnorr } from "@noble/curves/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { BitcoinClient } from "../core/bitcoin";
import { KeyPair, generateSpendingScriptForGrail, generateSpendingScriptsForUser } from "../core/taproot";
import { LabeledSignature } from "../core/types";
import { Network } from "../core/taproot/taptree";
import { getHash } from "../core/taproot/taproot-common";
import { showSpell } from "../core/charms-sdk";

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

  const previousTxs = [];
  for (const input of tx.ins) {
    let ttxhex: string;
    ttxhex = await bitcoinClient.getTransactionHex(input.hash.reverse().toString('hex'));
    const ttx = bitcoin.Transaction.fromHex(ttxhex);
    const out = ttx.outs[input.index];
    previousTxs.push({
      value: out.value, // Assuming the value is the same as the output being spent
      script: out.script
    });
  }

  // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
  const sighash = tx.hashForWitnessV1(
    inputIndex,
    previousTxs.map(tx => tx.script),
    previousTxs.map(tx => tx.value),
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
  spell: [Buffer, Buffer],
  rosterPublicKeys: string[],
  threshold: number,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptForGrail(rosterPublicKeys, threshold, network);

  return signTransactionInput(
    spell[0],
    0, // Assuming we are signing the first input
    spendingScript.script,
    keyPairs,
    threshold
  );
}

export async function grailSignCommitmentTransaction(
  commitmentTxBytes: Buffer,
  rosterPublicKeys: string[],
  threshold: number,
  recoveryPublicKey: string,
  timelockBlocks: number,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptsForUser(rosterPublicKeys, threshold, recoveryPublicKey, timelockBlocks, network);

  return signTransactionInput(
    commitmentTxBytes,
    1, // Assuming we are signing the second input (the user payment input)
    spendingScript.grail.script,
    keyPairs,
    threshold
  );
}

export function injectGrailSignaturesIntoTxInput(
  txBytes: Buffer,
  inputIndex: number,
  script: Buffer,
  controlBlock: Buffer,
  publicKeys: string[],
  threshold: number,
  signatures: LabeledSignature[]
): Buffer {

  if (signatures.length != threshold) {
    throw new Error(`Wrong number of signatures provided. Required: ${threshold}, provided: ${signatures.length}`);
  }

  if (signatures.some(sig => !publicKeys.includes(sig.publicKey))) {
    throw new Error(`Some signatures do not match the provided public keys.`);
  }

  // Order the signagures by public key to ensure deterministic ordering
  // leave 0 where missing signatures
  const map: { [key: string]: string } = {};
  signatures.forEach(sig => {
    map[sig.publicKey] = sig.signature.toString('hex');
  });
  const signaturesOrdered = publicKeys.map(pk => map[pk] || '');

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
  spell: [Buffer, Buffer],
  rosterPublicKeys: string[],
  threshold: number,
  recoveryPublicKey: string,
  timeoutBlocks: number,
  keyPairs: KeyPair[],
  network: Network): Promise<[Buffer, Buffer]> {

  const commitmentSignatures = await grailSignCommitmentTransaction(
    spell[0],
    rosterPublicKeys,
    threshold,
    recoveryPublicKey,
    timeoutBlocks,
    keyPairs,
    network
  );

  const commitmentSpendingScript = generateSpendingScriptsForUser(rosterPublicKeys, threshold, recoveryPublicKey, timeoutBlocks, network);
  const signedCommitmentTxBytes = injectGrailSignaturesIntoTxInput(
    spell[0],
    0,
    commitmentSpendingScript.grail.script,
    commitmentSpendingScript.grail.controlBlock,
    rosterPublicKeys,
    threshold,
    commitmentSignatures,
  );

  const grailSignatures = await grailSignSpellTransaction(
    spell,
    rosterPublicKeys,
    threshold,
    keyPairs,
    network
  );

  const spellSpendingScript = generateSpendingScriptForGrail(rosterPublicKeys, threshold, network);
  const signedSpellTxBytes = injectGrailSignaturesIntoTxInput(
    spell[0],
    0,
    spellSpendingScript.script,
    spellSpendingScript.controlBlock,
    rosterPublicKeys,
    threshold,
    grailSignatures
  );


  return [signedCommitmentTxBytes, signedSpellTxBytes];
}