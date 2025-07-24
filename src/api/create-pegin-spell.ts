import * as bitcoin from 'bitcoinjs-lib';
import { generateGrailPaymentAddress } from '../core/taproot';
import {
	GrailState,
	PegInRequest,
	Spell,
	UserPaymentDetails,
	Utxo,
} from '../core/types';
import { showSpell } from '../core/charms-sdk';
import { bufferReplacer } from '../core/json';
import { IContext } from '../core/i-context';
import { createUpdatingSpell } from './spell-operations';

export async function createPeginSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	nextGrailState: GrailState,
	userPaymentDetails: UserPaymentDetails,
	userWalletAddress: string,
	fundingUtxo?: Utxo
): Promise<Spell> {
	const previousNftTxhex =
		await context.bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}

	const grailAddress = generateGrailPaymentAddress(
		nextGrailState,
		context.network
	);
	const fundingChangeAddress = await context.bitcoinClient.getAddress();
	fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());

	const previousSpellData = await showSpell(context, previousNftTxhex);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, null, '\t')
	);

	const previousPublicKeys =
		previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
	const previousThreshold =
		previousSpellData.outs[0].charms['$0000'].current_threshold;

	const userPaymentTxHex = await context.bitcoinClient.getTransactionHex(
		userPaymentDetails.txid
	);
	if (!userPaymentTxHex) {
		throw new Error(
			`User payment transaction ${userPaymentDetails.txid} not found`
		);
	}
	const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
	const userPaymentAmount = userPaymentTx.outs[userPaymentDetails.vout].value;
	console.log('User payment transaction amount:', userPaymentAmount);

	const request: PegInRequest = {
		fundingUtxo,
		fundingChangeAddress,
		feerate,
		previousNftTxid,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: nextGrailState.publicKeys.join(','),
			threshold: nextGrailState.threshold,
		},
		amount: userPaymentAmount,
		userWalletAddress,

		toYamlObj: function () {
			return {
				version: 4,
				apps: {
					$00: `n/${context.appId}/${context.appVk}`,
					$01: `t/${context.appId}/${context.appVk}`,
				},
				public_inputs: {
					$00: { action: 'update' },
					$01: { action: 'mint' },
				},
				ins: [
					{
						utxo_id: `${previousNftTxid}:0`,
						charms: {
							$00: {
								ticker: context.ticker,
								current_cosigners: previousPublicKeys.join(','),
								current_threshold: previousThreshold,
							},
						},
					},
					{
						utxo_id: `${userPaymentDetails.txid}:${userPaymentDetails.vout}`,
					},
				],
				outs: [
					{
						address: this.nextNftAddress,
						charms: {
							$00: {
								ticker: context.ticker,
								current_cosigners: this.currentNftState.publicKeysAsString,
								current_threshold: this.currentNftState.threshold,
							},
						},
					},
					{
						address: this.nextNftAddress,
						amount: this.amount,
					},
					{
						address: this.userWalletAddress,
						charms: {
							$01: {
								amount: this.amount,
							},
						},
					},
				],
			};
		},
	};

	const spell = await createUpdatingSpell(
		context,
		request,
		[previousNftTxid, userPaymentDetails.txid],
		{ publicKeys: previousPublicKeys, threshold: previousThreshold },
		nextGrailState,
		userPaymentDetails
	);

	console.log(
		'Peg-in spell created:',
		JSON.stringify(spell, bufferReplacer, '\t')
	);
	return spell;
}
