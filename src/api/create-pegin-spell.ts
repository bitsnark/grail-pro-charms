import { logger } from '../core/logger';
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
import { getPreviousGrailState } from './spell-operations';

export async function createPeginSpell(
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
	logger.debug('User payment transaction amount: ', userPaymentAmount);

	const { spell, signatureRequest } = await createGeneralizedSpell(
		context,
		feerate,
		previousNftTxid,
		nextGrailState,
		{
			incomingUserBtc: [userPaymentDetails],
			incomingUserCharms: [],
			incomingGrailBtc: [],
			outgoingUserCharms: [
				{
					amount: userPaymentAmount,
					address: userPaymentDetails.userWalletAddress,
				},
			],
			outgoingUserBtc: [],
		},
		fundingUtxo
	);

	logger.debug('Peg-in spell created: ', spell);

	return { spell, signatureRequest };
}
