/* eslint-disable no-console */
import fs from 'node:fs';
import * as bitcoin from 'bitcoinjs-lib';
import { SimpleTapTree } from './taproot/taptree';
import { Network } from './taproot/taproot-common';
import { GrailState, UserPaymentDetails } from './types';
import { bufferReplacer } from './json';

if (!!process.env.DEBUG_TAPROOT) {
	try {
		if (!fs.existsSync('./debuglog/taproot')) {
			fs.mkdirSync('./debuglog/taproot', { recursive: true });
		}
	} catch (e) {
		console.error('Error in debugLog:', e);
	}
}

function debugLog(obj: any) {
	if (!process.env.DEBUG_TAPROOT) {
		return;
	}
	try {
		fs.writeFileSync(
			`./debuglog/taproot/${new Date()}`,
			JSON.stringify(obj, bufferReplacer, 2)
		);
	} catch (e) {
		console.error('Error writing debug log:', e);
	}
}

export interface KeyPair {
	publicKey: Buffer;
	privateKey: Buffer;
}

export interface SpendingScript {
	script: Buffer;
	controlBlock: Buffer;
}

export function generateSpendingScriptForGrail(
	grailState: GrailState,
	network: Network
): SpendingScript {
	debugLog({ grailState, network });

	const multisigScript = generateMultisigScript(grailState);
	const stt = new SimpleTapTree([multisigScript], network);
	return {
		script: multisigScript,
		controlBlock: stt.getControlBlock(0),
	};
}

function generateSpendingScriptForUserPayment(grailState: GrailState): Buffer {
	return generateMultisigScript(grailState);
}

function generateMultisigScript(grailState: GrailState): Buffer {
	const sortedCosigners = [...grailState.publicKeys].sort();
	const parts: any[] = sortedCosigners
		.map((cosigner, index) => [
			Buffer.from(cosigner, 'hex'),
			index === 0
				? bitcoin.opcodes.OP_CHECKSIG
				: bitcoin.opcodes.OP_CHECKSIGADD,
		])
		.flat();
	parts.push(bitcoin.script.number.encode(grailState.threshold));
	parts.push(bitcoin.opcodes.OP_NUMEQUAL);
	return bitcoin.script.compile(parts);
}

function generateSpendingScriptForUserRecovery(
	userPaymentDetails: Pick<
		UserPaymentDetails,
		'recoveryPublicKey' | 'timelockBlocks'
	>
): Buffer {
	const timelockScript = bitcoin.script.compile([
		bitcoin.script.number.encode(userPaymentDetails.timelockBlocks),
		bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
		bitcoin.opcodes.OP_DROP,
		Buffer.from(userPaymentDetails.recoveryPublicKey, 'hex'),
		bitcoin.opcodes.OP_CHECKSIG,
	]);
	return timelockScript;
}

export function generateSpendingScriptsForUserPayment(
	userPaymentDetails: UserPaymentDetails,
	network: Network
): { grail: SpendingScript; recovery: SpendingScript } {
	debugLog({
		grailState: userPaymentDetails.grailState,
		userPaymentDetails,
		network,
	});

	const grailScript = generateSpendingScriptForUserPayment(
		userPaymentDetails.grailState
	);
	const recoveryScript =
		generateSpendingScriptForUserRecovery(userPaymentDetails);
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
	grailState: GrailState,
	userPaymentDetails: Pick<
		UserPaymentDetails,
		'recoveryPublicKey' | 'timelockBlocks'
	>,
	network: Network
): string {
	debugLog({ grailState, userPaymentDetails, network });

	const grailScript = generateSpendingScriptForUserPayment(grailState);
	const recoveryScript =
		generateSpendingScriptForUserRecovery(userPaymentDetails);
	const stt = new SimpleTapTree([grailScript, recoveryScript], network);
	return stt.getTaprootAddress();
}

export function generateGrailPaymentAddress(
	grailState: GrailState,
	network: Network
): string {
	debugLog({ grailState, network });

	const multisigScript = generateSpendingScriptForGrail(grailState, network);
	const stt = new SimpleTapTree([multisigScript.script], network);
	return stt.getTaprootAddress();
}
