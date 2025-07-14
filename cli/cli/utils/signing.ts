import { schnorr } from "@noble/curves/secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { BitcoinClient } from "../../core/bitcoin";
import { KeyPair, generateSpendingScriptForGrail, generateSpendingScriptsForUser } from "../../core/taproot";
import { GrailState, LabeledSignature, Spell, UserPaymentDetails } from "../../core/types";
import { getHash, Network } from "../../core/taproot/taproot-common";
import { showSpell } from "../../core/charms-sdk";

// SIGHASH type for Taproot (BIP-342)
const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT || 0x00;

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

async function grailSignSpellNftInput(
  spell: Spell,
  inputIndex: number,
  grailState: GrailState,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptForGrail(grailState, network);

  return await signTransactionInput(
    spell.spellTxBytes,
    inputIndex,
    spendingScript.script,
    { [txBytesToTxid(spell.commitmentTxBytes)]: spell.commitmentTxBytes },
    keyPairs,
    grailState.threshold
  );
}

async function grailSignSpellUserInput(
  spell: Spell,
  inputIndex: number,
  grailState: GrailState,
  userPaymentDetails: UserPaymentDetails,
  keyPairs: KeyPair[],
  network: Network
): Promise<LabeledSignature[]> {

  const spendingScript = generateSpendingScriptsForUser(grailState, userPaymentDetails, network);
  return signTransactionInput(
    spell.spellTxBytes,
    inputIndex, // Assuming we are signing the second input (the user payment input)
    spendingScript.grail.script,
    { [txBytesToTxid(spell.commitmentTxBytes)]: spell.commitmentTxBytes },
    keyPairs,
    grailState.threshold
  );
}

function injectGrailSignaturesIntoTxInput(
  txBytes: Buffer,
  inputIndex: number,
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
  tx.ins[inputIndex].witness.unshift(...signaturesOrdered.map(sig => Buffer.from(sig, 'hex')));

  return tx.toBuffer();
}

export async function resignSpellWithTemporarySecret(
  spellTxBytes: Buffer,
  previousTxBytesMap: { [txid: string]: Buffer },
  temporarySecret: Buffer,
): Promise<Buffer> {

  const bitcoinClient = await BitcoinClient.create();

  // Load the transaction to sign
  const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
  const inputIndex = tx.ins.length - 1; // Last input is the commitment

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

  const script = tx.ins[inputIndex].witness[1]; // Tapleaf script
  const tapleafHash = getHash(script);

  // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
  const sighash = tx.hashForWitnessV1(
    inputIndex,
    previous.map(p => p.script),
    previous.map(p => p.value),
    sighashType,
    tapleafHash
  );

  const signature = schnorr.sign(sighash, temporarySecret);
  const temporaryPublicKey = schnorr.getPublicKey(temporarySecret);
  if (!schnorr.verify(signature, sighash, temporaryPublicKey)) {
    throw new Error('Temporary signature verification failed');
  }

  tx.ins[0].witness[0] = Buffer.from(signature);

  return tx.toBuffer();
}

export async function prepareSpell(
  spell: Spell,
  grailState: GrailState,
  userPaymentDetails: UserPaymentDetails | null,
  keyPairs: KeyPair[],
  network: Network,
  temporarySecret: Buffer): Promise<Spell> {

  // Clone it so we own it
  spell = { ...spell };

  const inputIndexNft = 0; // Assuming the first input is the NFT input

  const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);

  // First we create the missing input and the witnesses

  const spendingScriptNft =  generateSpendingScriptForGrail(grailState, network);
  spellTx.ins[inputIndexNft].witness = [
    // Signatures for the NFT input will be injected later
    ...Array(grailState.threshold).fill(Buffer.alloc(0)), // Placeholder for signatures
    spendingScriptNft.script, // Tapleaf script for the NFT input
    spendingScriptNft.controlBlock // Control block for the NFT input
  ];
  if (userPaymentDetails) {
    const inputIndexUser = 1; // Assuming the second input is the user payment input
    const spendingScriptUser = generateSpendingScriptsForUser(grailState, userPaymentDetails, network);
    spellTx.ins.splice(inputIndexUser, 0, {
      hash: txidToHash(userPaymentDetails.txid), // Placeholder, will be set later
      index: userPaymentDetails.vout,
      script: Buffer.alloc(0), // Placeholder, will be set later
      sequence: 0xffffffff, // Default sequence
      witness: [] // Will be filled later
    });
    spellTx.ins[inputIndexUser].witness = [
      // Signatures for the user payment input will be injected later
      ...Array(grailState.threshold).fill(Buffer.alloc(0)), // Placeholder for signatures
      spendingScriptUser.grail.script, // Tapleaf script for the user payment input
      spendingScriptUser.grail.controlBlock // Control block for the user payment input
    ];
  }

  // Now we can sign and inject the signatures into the transaction inputs

  const nftInputSignatures = await grailSignSpellNftInput(
    spell,
    inputIndexNft,
    grailState,
    keyPairs,
    network
  );
  spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
    spell.spellTxBytes,
    inputIndexNft,
    grailState,
    nftInputSignatures
  );

  if (userPaymentDetails) {

    const inputIndexUser = 1; // Assuming the second input is the user payment input

    const userInputSignatures = await grailSignSpellUserInput(
      spell,
      1,
      grailState,
      userPaymentDetails,
      keyPairs,
      network
    );
    spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
      spell.spellTxBytes,
      inputIndexUser,
      grailState,
      userInputSignatures
    );
  }

  const commitmentTxid = txBytesToTxid(spell.commitmentTxBytes);

  if (temporarySecret) {
    spell.spellTxBytes = await resignSpellWithTemporarySecret(
      spell.spellTxBytes,
      { [commitmentTxid]: spell.commitmentTxBytes },
      temporarySecret
    );
  }

  return spell;
}
