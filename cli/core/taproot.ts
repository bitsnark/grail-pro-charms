/* eslint-disable no-console */
import * as bitcoin from 'bitcoinjs-lib';
import { Network, SimpleTapTree } from './taproot/taptree';
import { schnorr } from "@noble/curves/secp256k1";
import { LabeledSignature } from './types';
import { getHash } from './taproot/taproot-common';


export interface SpendingScript {
  script: Buffer;
  controlBlock: Buffer;
}

export function generateSpendingScriptForGrail(
  cosigners: string[],
  requiredSignatures: number,
  network: Network
): SpendingScript {
  const multisigScript = generateMultisigScript(cosigners, requiredSignatures);
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
  return generateMultisigScript(cosigners, requiredSignatures);
}

function generateMultisigScript(cosigners: string[], requiredSignatures: number): Buffer {
  const sortedCosigners = [...cosigners].sort();
  const parts: any[] = sortedCosigners
    .map((cosigner, index) => [
      Buffer.from(cosigner, 'hex'),
      index === 0 ? bitcoin.opcodes.OP_CHECKSIG : bitcoin.opcodes.OP_CHECKSIGADD,
    ])
    .flat();
  parts.push(bitcoin.script.number.encode(requiredSignatures));
  parts.push(bitcoin.opcodes.OP_NUMEQUAL);
  return bitcoin.script.compile(parts);
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
  commitmentTxHex: string,
  previousTxHex: string,
  rawTxHex: string,
  rosterPublicKeys: string[],
  threshold: number,
  keyPairs: { publicKey: string; privateKey: string }[],
  network: Network
): LabeledSignature[] {

  if (keyPairs.length < threshold) {
    throw new Error(`Not enough key pairs provided. Required: ${threshold}, provided: ${keyPairs.length}`);
  }

  const spendingScript = generateSpendingScriptForGrail(rosterPublicKeys, threshold, network);

  const inputIndex = 0; // Assuming we are signing the first input
  const outputIndex = 0; // Assuming we are spending the first output of the previous transaction

  const commitmentTx = bitcoin.Transaction.fromHex(commitmentTxHex);
  const commitmentOutputScript = commitmentTx.outs[0].script;
  const commitmentOutputValue = commitmentTx.outs[0].value;

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
  // BitcoinJS v6+ exposes tapleafHash for this calculation
  const tapleafHash = getHash(spendingScript.script);

  // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
  const sighash = tx.hashForWitnessV1(
    inputIndex,
    [prevoutScriptPubKey, commitmentOutputScript],
    [prevoutValue, commitmentOutputValue],
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

export function injectGrailSignaturesIntoTxInput(
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
  const signaturesOrdered = publicKeys.map(pk => map[pk] || '');

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
