/* eslint-disable no-console */
import * as bitcoin from 'bitcoinjs-lib';
import { Network, SimpleTapTree } from './taproot/taptree';
import { schnorr } from "@noble/curves/secp256k1";
import { LabeledSignature } from './types';


export interface SpendingScript {
  script: Buffer;
  controlBlock: Buffer;
}

export function generateSpendingScriptForGrail(
  cosigners: string[],
  requiredSignatures: number,
  network: Network
): SpendingScript {
  const multisigScript = bitcoin.script.compile([
    bitcoin.script.number.encode(requiredSignatures),
    ...[...cosigners].sort().map((cosigner) => Buffer.from(cosigner, 'hex')),
    bitcoin.script.number.encode(cosigners.length),
    bitcoin.opcodes.OP_CHECKMULTISIG,
  ]);
  const stt = new SimpleTapTree([multisigScript], network);
  return {
    script: multisigScript,
    controlBlock: stt.getControlBlock(0),
  };
}

function generateSpendingScriptForUserPayment(
  cosigners: string[],
  requiredSignatures: number
): Buffer {
  const multisigScript = bitcoin.script.compile([
    bitcoin.script.number.encode(requiredSignatures),
    ...[...cosigners].sort().map((cosigner) => Buffer.from(cosigner, 'hex')),
    bitcoin.script.number.encode(cosigners.length),
    bitcoin.opcodes.OP_CHECKMULTISIG,
  ]);
  return multisigScript;
}

function generateSpendingScriptForUserRecovery(
  recoveryKey: string,
  timelockBlocks: number
): Buffer {
  const timelockScript = bitcoin.script.compile([
    bitcoin.script.number.encode(timelockBlocks),
    bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
    bitcoin.opcodes.OP_DROP,
    Buffer.from(recoveryKey, 'hex'),
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
  return timelockScript;
}

export function generateSpendingScriptsForUser(
  cosigners: string[],
  requiredSignatures: number,
  recoveryKey: string,
  timelockBlocks: number,
  network: Network
): { grail: SpendingScript; recovery: SpendingScript } {
  const grailScript = generateSpendingScriptForUserPayment(cosigners, requiredSignatures);
  const recoveryScript = generateSpendingScriptForUserRecovery(recoveryKey, timelockBlocks);
  const stt = new SimpleTapTree([grailScript, recoveryScript], network);
  return {
    grail: {
      script: grailScript,
      controlBlock: stt.getControlBlock(0),
    },
    recovery: {
      script: recoveryScript,
      controlBlock: stt.getControlBlock(1),
    },
  };
}

export function generateUserPaymentAddress(
  recoveryKey: string,
  cosigners: string[],
  timelockBlocks: number,
  requiredSignatures: number,
  network: Network
): string {
  const grailScript = generateSpendingScriptForUserPayment(cosigners, requiredSignatures);
  const recoveryScript = generateSpendingScriptForUserRecovery(recoveryKey, timelockBlocks);
  const stt = new SimpleTapTree([grailScript, recoveryScript], network);
  return stt.getTaprootAddress();
}

export function generateGrailPaymentAddress(
  cosigners: string[],
  requiredSignatures: number,
  network: Network
): string {
  const multisigScript = generateSpendingScriptForGrail(cosigners, requiredSignatures, network);
  const stt = new SimpleTapTree([multisigScript.script], network);
  return stt.getTaprootAddress();
}

export function grailSignTx(
  previousTxHex: string,
  rawTxHex: string,
  rosterPublicKeys: string[],
  threshold: number,
  keyPairs: { publicKey: string; privateKey: Buffer }[],
  network: Network
): LabeledSignature[] {

  if (keyPairs.length < threshold) {
    throw new Error(`Not enough key pairs provided. Required: ${threshold}, provided: ${keyPairs.length}`);
  }

  const spendingScript = generateSpendingScriptForGrail(rosterPublicKeys, threshold, network);

  const inputIndex = 0; // Assuming we are signing the first input
  const outputIndex = 0; // Assuming we are spending the first output of the previous transaction

  const prevTx = bitcoin.Transaction.fromHex(previousTxHex);

  // Always use output 0 of previous tx
  const prevout = prevTx.outs[outputIndex];
  if (!prevout) throw new Error(`No output ${outputIndex} in previous transaction`);

  const prevoutScriptPubKey = prevout.script;
  const prevoutValue = prevout.value;

  // Load the transaction to sign
  const tx = bitcoin.Transaction.fromHex(rawTxHex);

  // SIGHASH type for Taproot (BIP-342)
  const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT || 0x00;

  // Tapleaf version for tapscript is always 0xc0
  const leafVersion = 0xc0;
  // BitcoinJS v6+ exposes tapleafHash for this calculation
  const tapleafHash = (bitcoin as any).crypto.tapleafHash({
    output: spendingScript.script,
    version: leafVersion,
  });

  // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
  const sighash = (tx as any).hashForWitnessV1(
    inputIndex,
    [prevoutScriptPubKey],
    [prevoutValue],
    sighashType,
    tapleafHash
  );

  // We only need threshold signatures, so we can ignore the rest
  const requiredKeypairs = keyPairs.slice(0, threshold);

  return requiredKeypairs.map(({ publicKey, privateKey }) => {
    const sig = schnorr.sign(sighash, privateKey);
    return {
      publicKey,
      signature: Buffer.from(sig),
    } as LabeledSignature;
  });
}

export function injectGrailSignaturesIntoTxInut(
  rawTxHex: string,
  publicKeys: string[],
  threshold: number,
  signatures: LabeledSignature[],
  network: Network
): string {

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
  const signaturesOrdered = publicKeys.map(pk => map[pk] || '0'.repeat(128)); // 64 bytes hex = 128 chars

  const spendingScript = generateSpendingScriptForGrail(publicKeys, threshold, network);

  const inputIndex = 0; // Assuming we are signing the first input

  // Load the transaction to sign
  const tx = bitcoin.Transaction.fromHex(rawTxHex);

  // Witness: [signature] [tapleaf script] [control block]
  tx.setWitness(inputIndex, [
    ...signaturesOrdered.map(sig => Buffer.from(sig, 'hex')),
    spendingScript.script,
    spendingScript.controlBlock
  ]);

  return tx.toHex();
}
