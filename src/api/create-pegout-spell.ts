import { logger } from '../core/logger';
import * as bitcoin from 'bitcoinjs-lib';
import { GrailState, SignatureRequest, Spell, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { createGeneralizedSpell } from './create-generalized-spell';
import { getPreviousGrailState } from './spell-operations';
import { hashToTxid } from '../core/bitcoin';
import { getCharmsAmountFromUtxo, getStateFromNft } from '../core/spells';
import { UserPaymentDetails } from '../core/types';
import { generateGrailPaymentAddress } from '../core/taproot';
import { bitcoinjslibNetworks } from '../core/taproot/taproot-common';
import { filterAsync } from '../core/array-utils';
import { LOCKED_BTC_MIN_AMOUNT } from '../cli/consts';

export async function findLockedBtcUtxos(
	context: IContext,
	lastNftTxid: string,
	minAmount: number
): Promise<Utxo[]> {
	const selectedUtxos: Utxo[] = [];
	let nftTxid: string | null = lastNftTxid;
	while (nftTxid) {
		const state = await getStateFromNft(context, nftTxid); // Ensure the state is fetched
		if (!state) break;
		const grailAddress = generateGrailPaymentAddress(state, context.network);
		const tx = bitcoin.Transaction.fromBuffer(
			await context.bitcoinClient.getTransactionBytes(nftTxid)
		);
		const outputScript = bitcoin.address.toOutputScript(
			grailAddress,
			bitcoinjslibNetworks[context.network]
		);
		const utxos = tx.outs
			.map((out, index) => ({
				txid: nftTxid!,
				vout: index,
				value: out.value,
				script: out.script,
			}))
			.filter(
				utxo =>
					utxo.value >= LOCKED_BTC_MIN_AMOUNT &&
					utxo.script.equals(outputScript)
			);
		const unspent = await filterAsync(utxos, async utxo => {
			return await context.bitcoinClient.isUtxoSpendable(utxo.txid, utxo.vout);
		});
		selectedUtxos.push(...unspent);
		nftTxid = tx.ins[0] ? hashToTxid(tx.ins[0].hash) : null;
	}

	const totalAmount = selectedUtxos.reduce(
		(sum, utxo) => sum + (utxo?.value ?? 0),
		0
	);

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

	const userPaymentAmount = await getCharmsAmountFromUtxo(
		context,
		userPaymentDetails
	);
	logger.debug('User payment transaction amount: ', userPaymentAmount);

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
			incomingUserBtc: [],
			incomingUserCharms: [userPaymentDetails],
			incomingGrailBtc: lockedBtcUtxos,
			outgoingUserCharms: [],
			outgoingUserBtc: [
				{
					amount: userPaymentAmount,
					address: userPaymentDetails.userWalletAddress,
				},
			],
		},
		{},
		fundingUtxo
	);

	logger.debug('Peg-in spell created: ', spell);

	return { spell, signatureRequest };
}
