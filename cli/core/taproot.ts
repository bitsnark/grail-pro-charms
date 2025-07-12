/* eslint-disable no-console */
import * as bitcoin from 'bitcoinjs-lib';
import { Network, SimpleTapTree } from './taproot/taptree';
import { schnorr } from "@noble/curves/secp256k1";
import { LabeledSignature } from './types';
import { getHash } from './taproot/taproot-common';
import { BitcoinClient } from './bitcoin';

export interface KeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
}

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
