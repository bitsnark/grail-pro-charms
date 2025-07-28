import * as bitcoin from 'bitcoinjs-lib';
import {
	CosignerSignatures,
	GeneralizedRequest,
	PreviousTransactions,
	SignatureRequest,
	SignatureResponse,
	Spell,
	UpdateRequest,
	Utxo,
} from '../core/types';
import {
	KeyPair,
	generateSpendingScriptForGrail,
	generateSpendingScriptsForUserPayment,
	generateUserPaymentAddress,
} from '../core/taproot';
import { GrailState, UserPaymentDetails, GeneralizedInfo } from '../core/types';
import { IContext } from '../core/i-context';
import {
	createSpell,
	resignSpellWithTemporarySecret,
	signTransactionInput,
} from '../core/spells';
import { showSpell } from '../core/charms-sdk';
import { bitcoinjslibNetworks, Network } from '../core/taproot/taproot-common';
import { hashToTxid, txBytesToTxid } from '../core/bitcoin';

export async function getPreviousGrailState(
	context: IContext,
	previousNftTxid: string
): Promise<GrailState> {
	const previousSpellData = await showSpell(context, previousNftTxid);
	if (!previousSpellData) {
		throw new Error('Invalid previous NFT spell data');
	}
	return {
		publicKeys:
			previousSpellData.outs[0].charms['$0000'].current_cosigners.split(','),
		threshold: previousSpellData.outs[0].charms['$0000'].current_threshold,
	};
}

export async function getPreviousGrailStateMap(
	context: IContext,
	txids: string[]
): Promise<{ [key: string]: GrailState }> {
	const previousGrailStates: { [key: string]: GrailState } = {};
	for (const txid of txids) {
		previousGrailStates[txid] = await getPreviousGrailState(context, txid);
	}
	return previousGrailStates;
}

export async function createUpdatingSpell(
	context: IContext,
	request: UpdateRequest,
	previousTxIds: string[],
	previousGrailState: GrailState,
	nextGrailState: GrailState,
	generalizedInfo: GeneralizedInfo
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

	let userInputIndex = inputIndexNft + 1;
	for (const input of generalizedInfo.incomingUserBtc) {
		const spendingScriptUser = generateSpendingScriptsForUserPayment(
			input,
			context.network
		);
		spellTx.ins[userInputIndex++].witness = [
			spendingScriptUser.grail.script,
			spendingScriptUser.grail.controlBlock,
		];
	}

	spell.spellTxBytes = spellTx.toBuffer();
	return spell;
}

function injectGrailSignaturesIntoTxInput(
	txBytes: Buffer,
	inputIndex: number,
	signatures: Buffer[]
): Buffer {
	// Load the transaction to sign
	const tx = bitcoin.Transaction.fromBuffer(txBytes);
	// Witness: [signatures] [tapleaf script] [control block]
	tx.ins[inputIndex].witness = [...signatures, ...tx.ins[inputIndex].witness];
	return tx.toBuffer();
}

export async function injectSignaturesIntoSpell(
	context: IContext,
	spell: Spell,
	signatureRequest: SignatureRequest,
	fromCosigners: SignatureResponse[]
): Promise<Spell> {
	// Clone it so we own it
	spell = { ...spell };

	// Prepare signatures for injection by input index
	const signaturesByIndex: Buffer[][] = [];

	for (const input of signatureRequest.inputs) {
		// Extract the signatures for this input, but only for the cosigners that are part of its Grail state
		const labeledSignatures = fromCosigners
			.filter(ti => input.state.publicKeys.find(pk => pk === ti.publicKey))
			.map(ti => {
				const lsigs = ti.signatures.filter(sig => sig.index === input.index);
				if (lsigs.length > 1)
					throw new Error(
						`Multiple signatures for input ${input.index} from cosigner ${ti.publicKey}`
					);
				return { publicKey: ti.publicKey, signature: lsigs[0].signature };
			});
		// Do we have enbough signatures?
		if (labeledSignatures.length < input.state.threshold) {
			throw new Error(
				`Not enough signatures for input ${input.index}. Required: ${input.state.threshold}, provided: ${labeledSignatures.length}`
			);
		}
		// We only need enough for the threshold
		labeledSignatures.length = input.state.threshold;

		// Now we need to sort them and insert 0 where missing
		const signaturesOrdered = input.state.publicKeys.map(
			(pk: string) =>
				labeledSignatures.find(lsig => lsig.publicKey === pk)?.signature ||
				Buffer.from([])
		);

		signaturesByIndex[input.index] = signaturesOrdered;
	}

	for (let index = 0; index < signaturesByIndex.length; index++) {
		const signatures = signaturesByIndex[index];
		if (!signatures || signatures.length === 0) {
			continue; // No signatures for this input
		}
		spell.spellTxBytes = injectGrailSignaturesIntoTxInput(
			spell.spellTxBytes,
			index,
			signatures
		);
	}

	const commitmentTxid = txBytesToTxid(spell.commitmentTxBytes);

	spell.spellTxBytes = await resignSpellWithTemporarySecret(
		context,
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

export async function getPreviousTransactions(
	context: IContext,
	spellTxBytes: Buffer,
	commitmentTxBytes?: Buffer
): Promise<PreviousTransactions> {
	const result: PreviousTransactions = commitmentTxBytes
		? {
				[txBytesToTxid(commitmentTxBytes)]: commitmentTxBytes,
			}
		: {};
	const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
	for (const input of tx.ins) {
		const txid = hashToTxid(input.hash);
		if (!(txid in result)) {
			const txBytes = await context.bitcoinClient.getTransactionHex(txid);
			result[txid] = Buffer.from(txBytes, 'hex');
		}
	}
	return result;
}

export function signAsCosigner(
	context: IContext,
	request: SignatureRequest,
	keypair: KeyPair
): CosignerSignatures[] {
	const sigs: CosignerSignatures[] = request.inputs.map(input => ({
		index: input.index,
		signature: signTransactionInput(
			context,
			request.transactionBytes,
			input.index,
			input.script,
			request.previousTransactions,
			keypair
		),
	}));
	return sigs;
}

export async function findUserPaymentVout(
	context: IContext,
	grailState: GrailState,
	userPaymentTxid: string,
	recoveryPublicKey: string,
	timelockBlocks: number
): Promise<number> {
	const userPaymentTxHex =
		await context.bitcoinClient.getTransactionHex(userPaymentTxid);
	if (!userPaymentTxHex) {
		throw new Error(`User payment transaction ${userPaymentTxid} not found`);
	}
	const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
	const userPaymentAddress = generateUserPaymentAddress(
		grailState,
		{ recoveryPublicKey, timelockBlocks },
		context.network
	);
	const index = userPaymentTx.outs.findIndex(out => {
		// Convert address to script and compare
		const outScript = bitcoin.address.toOutputScript(
			userPaymentAddress,
			bitcoinjslibNetworks[context.network]
		);
		return out.script.compare(outScript) == 0;
	});
	if (index === -1) {
		throw new Error(
			`User payment address ${userPaymentAddress} not found in transaction ${userPaymentTxid}`
		);
	}
	return index;
}

export async function getUserWalletAddressFromUserPaymentUtxo(
	context: IContext,
	fundingUtxo: Utxo,
	network: Network
): Promise<string> {
	const txBytes = await context.bitcoinClient.getTransactionBytes(fundingUtxo.txid);
	const tx = bitcoin.Transaction.fromBuffer(txBytes);
	if (tx.outs.length < 2) {
		throw new Error('Funding UTXO has no inputs');
	}
	const changeOutput = fundingUtxo.vout == 0 ? 1 : 0;
	const script = tx.outs[changeOutput].script;

	const address = [
		bitcoin.payments.p2ms,
		bitcoin.payments.p2pk,
		bitcoin.payments.p2pkh,
		bitcoin.payments.p2sh,
		bitcoin.payments.p2wpkh,
		bitcoin.payments.p2wsh,
		bitcoin.payments.p2tr,
	]
		.map(payment => {
			try {
				return payment({
					output: script,
					network: bitcoinjslibNetworks[network],
				}).address;
			} catch (e) {
				return undefined;
			}
		})
		.filter(Boolean)[0];
	if (!address) {
		throw new Error('No valid address found for the script');
	}
	return address;
}
