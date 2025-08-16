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
import { parse } from '../core/env-parser';

export function isNftSpendableByState(
	nftState: GrailState,
	nextState: GrailState
): boolean {
	let counter = 0;
	for (const publicKey of nftState.publicKeys) {
		counter += nextState.publicKeys.includes(publicKey) ? 1 : 0;
	}
	return counter >= nftState.threshold;
}

// TODO: Scan the chain from the beginning instead of from the end So that we recycle old locked BTC UTXOs first
// TODO: Move to spell-operations

export async function findLockedBtcUtxos(
	context: IContext,
	lastNftTxid: string,
	minAmount: number,
	nextGrailState: GrailState
): Promise<Utxo[]> {
	const selectedUtxos: Utxo[] = [];
	let nftTxid: string | null = lastNftTxid;
	let totalAmount = 0;
	while (nftTxid) {
		const state = await getStateFromNft(context, nftTxid); // Ensure the state is fetched
		if (!state) break;

		if (!isNftSpendableByState(state, nextGrailState)) {
			logger.warn(
				`NFT state ${nftTxid} is not spendable by the next state. Skipping...`
			);
			break;
		}

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
		for (const utxo of unspent) {
			selectedUtxos.push(utxo);
			totalAmount += utxo.value;
			if (totalAmount >= minAmount + LOCKED_BTC_MIN_AMOUNT) {
				break;
			}
		}
		if (!tx.ins[0]?.hash) break;
		nftTxid = hashToTxid(tx.ins[0].hash);
	}

	if (totalAmount < minAmount + LOCKED_BTC_MIN_AMOUNT) {
		throw new Error(
			`Not enough locked BTC UTXOs found. Required: ${minAmount + LOCKED_BTC_MIN_AMOUNT}`
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
	lockedBtcUtxos?: Utxo[],
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

	if (!fundingUtxo) {
		const defaultTransactionSize = parse.number(
			'BTC_DEFAULT_TRANSACTION_SIZE',
			250
		);
		fundingUtxo = await context.bitcoinClient.getFundingUtxo(
			feerate * defaultTransactionSize
		);
	}

	const userPaymentAmount = await getCharmsAmountFromUtxo(
		context,
		userPaymentDetails
	);
	logger.debug('User payment transaction amount: ', userPaymentAmount);

	lockedBtcUtxos =
		lockedBtcUtxos ??
		(await findLockedBtcUtxos(
			context,
			previousNftTxid,
			userPaymentAmount,
			nextGrailState
		));

	const totalLockedBtcAmount = lockedBtcUtxos.reduce(
		(acc, utxo) => acc + (utxo?.value ?? 0),
		0
	);
	logger.debug('Total locked BTC amount: ', totalLockedBtcAmount);
	if (totalLockedBtcAmount < userPaymentAmount + LOCKED_BTC_MIN_AMOUNT) {
		throw new Error(
			`Not enough locked BTC UTXOs found. Required: ${userPaymentAmount + LOCKED_BTC_MIN_AMOUNT}`
		);
	}

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
