import * as bitcoin from 'bitcoinjs-lib';
import { SignaturePackage, Spell, UpdateRequest } from '../core/types';
import { BitcoinClient } from '../core/bitcoin';

import {
	KeyPair,
	generateSpendingScriptForGrail,
	generateSpendingScriptsForUserPayment,
} from '../core/taproot';
import {
	GrailState,
	UserPaymentDetails,
} from '../core/types';
import { IContext } from '../core/i-context';
import {
	createSpell,
	grailSignSpellNftInput,
	grailSignSpellUserInput,
	injectGrailSignaturesIntoTxInput,
	resignSpellWithTemporarySecret,
	txBytesToTxid,
	txidToHash,
} from '../core/spells';
import { showSpell } from '../core/charms-sdk';

export async function getPreviousGrailState(
	context: IContext,
	previousNftTxid: string
): Promise<GrailState> {
	const previousNftTxhex =
		await context.bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}
	const previousSpellData = await showSpell(context, previousNftTxhex);
	if (!previousSpellData) {
		throw new Error('Invalid previous NFT spell data');
	}
	return {
		publicKeys:
			previousSpellData.outs[0].charms['$0000'].current_cosigners.split(','),
		threshold: previousSpellData.outs[0].charms['$0000'].current_threshold,
	};
}

export async function createUpdatingSpell(
	context: IContext,
	request: UpdateRequest,
	previousTxIds: string[],
	previousGrailState: GrailState,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails | null
): Promise<Spell> {
	const spell = await createSpell(context, previousTxIds, request);

	const inputIndexNft = 0; // Assuming the first input is the NFT input

	const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);

	const spendingScriptGrail = generateSpendingScriptForGrail(
		previousGrailState,
		context.network
	);
	spellTx.ins[inputIndexNft].witness = [
		// bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
		spendingScriptGrail.script,
		spendingScriptGrail.controlBlock,
	];

	if (userPaymentDetails) {

		const userPaymentTxHex = await context.bitcoinClient.getTransactionHex(
			userPaymentDetails.txid
		);
		const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
		const userPaymentOutput = userPaymentTx.outs[userPaymentDetails.vout];

		const inputIndexUser = 1; // Assuming the second input is the user payment input

		const spendingScriptUser = generateSpendingScriptsForUserPayment(
			nextGrailState,
			userPaymentDetails,
			context.network
		);
		spellTx.ins[inputIndexUser] = {
			hash: txidToHash(userPaymentDetails.txid),
			index: userPaymentDetails.vout,
			script: Buffer.from(''),
			sequence: 0xffffffff,
			witness: [
				spendingScriptUser.grail.script,
				spendingScriptUser.grail.controlBlock,
			],
		};
	}

	spell.spellTxBytes = spellTx.toBuffer();

	return spell;
}

export async function signSpell(
	context: IContext,
	spell: Spell,
	previousNftTxid: string,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails | null,
	keyPairs: KeyPair[]
): Promise<SignaturePackage> {
	// Clone it so we own it
	spell = { ...spell };

	const inputIndexNft = 0; // Assuming the first input is the NFT input

	const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
	const previousGrailState = await getPreviousGrailState(
		context,
		previousNftTxid
	);

	const spendingScriptGrail = generateSpendingScriptForGrail(
		previousGrailState,
		context.network
	);
	spellTx.ins[inputIndexNft].witness = [
		// bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
		spendingScriptGrail.script,
		spendingScriptGrail.controlBlock,
	];

	spell.spellTxBytes = spellTx.toBuffer();

	// Now we can sign and inject the signatures into the transaction inputs

	const nftInputSignatures = await grailSignSpellNftInput(
		spell,
		inputIndexNft,
		previousGrailState,
		keyPairs,
		context.network
	);

	const allSignatures = [];
	allSignatures[inputIndexNft] = nftInputSignatures;

	if (userPaymentDetails) {
		const inputIndexUser = 1; // Assuming the second input is the user payment input
		const userInputSignatures = await grailSignSpellUserInput(
			spell,
			inputIndexUser,
			nextGrailState,
			userPaymentDetails,
			keyPairs,
			context.network
		);
		allSignatures[inputIndexUser] = userInputSignatures;
	}

	return allSignatures;
}

export async function injectSignaturesIntoSpell(
	context: IContext,
	spell: Spell,
	previousNftTxid: string,
	signaturePackage: SignaturePackage
): Promise<Spell> {
	// Clone it so we own it
	spell = { ...spell };

	const previousGrailState = await getPreviousGrailState(
		context,
		previousNftTxid
	);

	for (let index = 0; index < signaturePackage.length; index++) {
		const signatures = signaturePackage[index];
		if (!signatures || signatures.length === 0) {
			continue; // No signatures for this input
		}
		spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
			spell.spellTxBytes,
			index,
			previousGrailState,
			signatures
		);
	}

	const commitmentTxid = txBytesToTxid(spell.commitmentTxBytes);

	spell.spellTxBytes = await resignSpellWithTemporarySecret(
		spell.spellTxBytes,
		{ [commitmentTxid]: spell.commitmentTxBytes },
		context.temporarySecret
	);

	return spell;
}

export async function transmitSpell(
	context: IContext,
	transactions: Spell
): Promise<[string, string]> {
	console.log('Transmitting spell...');

	const commitmentTxHex = transactions.commitmentTxBytes.toString('hex');
	const signedCommitmentTxHex = await context.bitcoinClient.signTransaction(
		commitmentTxHex,
		undefined,
		'ALL|ANYONECANPAY'
	);

	console.info('Sending commitment transaction:', signedCommitmentTxHex);
	const commitmentTxid = await context.bitcoinClient.transmitTransaction(
		signedCommitmentTxHex
	);

	const spellTransactionHex = transactions.spellTxBytes.toString('hex');

	console.info('Sending spell transaction:', spellTransactionHex);
	const spellTxid =
		await context.bitcoinClient.transmitTransaction(spellTransactionHex);

	const output: [string, string] = [commitmentTxid, spellTxid];
	console.log('Spell transmitted successfully:', output);

	return output;
}
