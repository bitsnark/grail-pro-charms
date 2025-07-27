import * as bitcoin from 'bitcoinjs-lib';
import {
	GrailState,
	SignatureRequest,
	Spell,
	UserPaymentDetails,
	Utxo,
} from '../core/types';
import { bufferReplacer } from '../core/json';
import { IContext } from '../core/i-context';
import { createGeneralizedSpell } from './create-generalized-spell';
import { showSpell } from '../core/charms-sdk';
import {
	getPreviousGrailState,
	getPreviousTransactions,
} from './spell-operations';

export async function findLockedBtcUtxos(
	context: IContext,
	lestNftTxid: string,
	minAmount: number
): Promise<Utxo[]> {
	const selectedUtxos: Utxo[] = [];
	let totalAmount = 0;

	let nftTxid = lestNftTxid;
	while (nftTxid) {
		const nftTxBytes = await context.bitcoinClient.getTransactionBytes(nftTxid);
		const previousTransactions = await getPreviousTransactions(
			context,
			nftTxBytes
		);
		const spellData = await showSpell(
			context,
			nftTxid,
			Object.values(previousTransactions)
		);
		if (!spellData) {
			throw new Error(`Spell data for transaction ${nftTxid} not found`);
		}
		const utxos = spellData.outs
			.map((out: any, index: number) => ({
				index,
				amount: out.charms['$0000'].amount,
				type: out.type,
			}))
			.filter((t: any) => t.type == 'locked_btc');
		for (const utxo of utxos) {
			if (await context.bitcoinClient.isUtxoSpendable(utxo.txid, utxo.index)) {
				selectedUtxos.push(utxo);
				totalAmount += utxo.amount;
			}
		}
		nftTxid = spellData.ins[0].prevout.txid; // Assuming the first input is the NFT input
	}

	if (totalAmount < minAmount) {
		throw new Error(
			`Not enough BTC locked UTXOs found. Required: ${minAmount}`
		);
	}

	return selectedUtxos;
}

export async function createPegoutSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails,
	userWalletAddress: string,
	fundingUtxo?: Utxo
): Promise<{ spell: Spell; signatureRequest: SignatureRequest }> {
	const previousNftTxhex =
		await context.bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}

	const previousGrailState = await getPreviousGrailState(
		context,
		previousNftTxid
	);
	if (!previousGrailState) {
		throw new Error('Previous Grail state not found');
	}

	fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());

	const userPaymentTxBytes = await context.bitcoinClient.getTransactionBytes(
		userPaymentDetails.txid
	);
	if (!userPaymentTxBytes) {
		throw new Error(
			`User payment transaction ${userPaymentDetails.txid} not found`
		);
	}
	const userPaymentTx = bitcoin.Transaction.fromBuffer(userPaymentTxBytes);
	const userPaymentAmount = userPaymentTx.outs[userPaymentDetails.vout].value;
	console.log('User payment transaction amount:', userPaymentAmount);

	const lockedBtcUtxos = await findLockedBtcUtxos(
		context,
		previousNftTxid,
		userPaymentAmount
	);

	const { spell, signatureRequest } = await createGeneralizedSpell(
		context,
		feerate,
		previousNftTxid,
		nextGrailState,
		{
			incomingUserBtc: [userPaymentDetails],
			incomingUserCharms: [userPaymentDetails],
			incomingGrailBtc: lockedBtcUtxos,
			outgoingUserCharms: [],
			outgoingUserBtc: [
				{ amount: userPaymentAmount, address: userWalletAddress },
			],
		},
		fundingUtxo
	);

	console.log(
		'Peg-in spell created:',
		JSON.stringify(spell, bufferReplacer, '\t')
	);

	return { spell, signatureRequest };
}
