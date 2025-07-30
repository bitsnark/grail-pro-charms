import * as bitcoin from 'bitcoinjs-lib';
import {
	generateGrailPaymentAddress,
	generateSpendingScriptForGrail,
	generateSpendingScriptsForUserPayment,
} from '../core/taproot';
import {
	GeneralizedInfo,
	GeneralizedRequest,
	GrailState,
	SignatureRequest,
	Spell,
	Utxo,
} from '../core/types';
import { showSpell } from '../core/charms-sdk';
import { bufferReplacer } from '../core/json';
import { IContext } from '../core/i-context';
import {
	createUpdatingSpell,
	getPreviousGrailState,
	getPreviousGrailStateMap,
} from './spell-operations';
import { getCharmsAmountFromUtxo } from '../core/spells';
import { mapAsync } from '../core/array-utils';
import { DUST_LIMIT, txBytesToTxid } from '../core/bitcoin';

function getAmountFromUtxo(
	previousTransactions: { [key: string]: Buffer },
	utxo: Utxo
): number {
	if (!previousTransactions[utxo.txid]) {
		throw new Error(
			`Transaction ${utxo.txid} not found in previous transactions`
		);
	}
	const tx = bitcoin.Transaction.fromBuffer(previousTransactions[utxo.txid]);
	if (utxo.vout >= tx.outs.length) {
		throw new Error(
			`Output index ${utxo.vout} out of bounds for transaction ${utxo.txid}`
		);
	}
	return tx.outs[utxo.vout].value;
}

async function sanityCheck(
	context: IContext,
	previousTransactions: { [key: string]: Buffer },
	generalizedInfo: GeneralizedInfo
): Promise<void> {
	if (!generalizedInfo.outgoingGrailBtc) {
		throw new Error('Outgoing Grail BTC is required in generalizedInfo');
	}

	// Let's check each user gets the correct amount of BTC
	for (const outgoing of generalizedInfo.outgoingUserBtc) {
		const upd = generalizedInfo.incomingUserCharms.find(
			incoming => incoming.userWalletAddress === outgoing.address
		);
		if (!upd) {
			throw new Error(
				`Outgoing BTC to ${outgoing.address} not matched by incoming charms`
			);
		}
		const amount = getAmountFromUtxo(previousTransactions, upd);
		if (amount !== outgoing.amount) {
			throw new Error(
				`Outgoing BTC amount ${outgoing.amount} does not match incoming charms ${amount} for address ${outgoing.address}`
			);
		}
	}

	// Let's check each user gets the correct amount of charms
	for (const outgoing of generalizedInfo.outgoingUserCharms) {
		const upd = generalizedInfo.incomingUserBtc.find(
			incoming => incoming.userWalletAddress === outgoing.address
		);
		if (!upd) {
			throw new Error(
				`Outgoing charms to ${outgoing.address} not matched by incoming BTC`
			);
		}
		const amount = getAmountFromUtxo(previousTransactions, upd);
		if (amount !== outgoing.amount) {
			throw new Error(
				`Outgoing charms amount ${outgoing.amount} does not match incoming ${amount} for address ${outgoing.address}`
			);
		}
	}

	// Let's check that this operation does not create or destroy the total amount of BTC and Charms
	const totalIncomingBtc = [
		...generalizedInfo.incomingUserBtc,
		...generalizedInfo.incomingGrailBtc,
	]
		.map(payment => getAmountFromUtxo(previousTransactions, payment))
		.reduce((a, b) => a + b, 0);
	const totalIncomingCharms = (
		await mapAsync(generalizedInfo.incomingUserCharms, utxo =>
			getCharmsAmountFromUtxo(context, utxo)
		)
	).reduce((a, b) => a + b, 0);
	const totalOutgoingBtc = [
		...generalizedInfo.outgoingUserBtc,
		generalizedInfo.outgoingGrailBtc,
	]
		.map(outgoing => outgoing.amount)
		.reduce((a, b) => a + b, 0);
	const totalOutgoingCharms = generalizedInfo.outgoingUserCharms
		.map(outgoing => outgoing.amount)
		.reduce((a, b) => a + b, 0);
	if (
		totalIncomingBtc + totalIncomingCharms !==
		totalOutgoingBtc + totalOutgoingCharms
	) {
		throw new Error(
			`Total incoming (${totalIncomingBtc} BTC + ${totalIncomingCharms} Charms) does not match total outgoing (${totalOutgoingBtc} BTC + ${totalOutgoingCharms} Charms)`
		);
	}

	// No output amount is allowed to be lower than dust limit
	for (const outgoing of [
		...generalizedInfo.outgoingUserBtc,
		...generalizedInfo.outgoingUserCharms,
	]) {
		if (outgoing.amount < DUST_LIMIT) {
			throw new Error(
				`Outgoing amount for address ${outgoing.address} is lower than dust limit: ${outgoing.amount} < ${DUST_LIMIT}`
			);
		}
	}
}

async function calculateExcessBitcoin(
	context: IContext,
	previousTransactions: { [key: string]: Buffer },
	generalizedInfo: GeneralizedInfo
): Promise<number> {
	// Let's check that this operation does not create or destroy the total amount of BTC and Charms
	const totalIncomingBtc = [
		...generalizedInfo.incomingUserBtc,
		...generalizedInfo.incomingGrailBtc,
	]
		.map(payment => getAmountFromUtxo(previousTransactions, payment))
		.reduce((a, b) => a + b, 0);
	const totalIncomingCharms = (
		await mapAsync(generalizedInfo.incomingUserCharms, utxo =>
			getCharmsAmountFromUtxo(context, utxo)
		)
	).reduce((a, b) => a + b, 0);
	const totalOutgoingBtc = generalizedInfo.outgoingUserBtc
		.map(outgoing => outgoing.amount)
		.reduce((a, b) => a + b, 0);
	const totalOutgoingCharms = generalizedInfo.outgoingUserCharms
		.map(outgoing => outgoing.amount)
		.reduce((a, b) => a + b, 0);
	return (
		totalIncomingBtc +
		totalIncomingCharms -
		totalOutgoingBtc -
		totalOutgoingCharms
	);
}

export async function createGeneralizedSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	nextGrailState: GrailState,
	generalizedInfo: GeneralizedInfo,
	fundingUtxo?: Utxo
): Promise<{ spell: Spell; signatureRequest: SignatureRequest }> {
	const allPreviousTxids = [
		previousNftTxid,
		...generalizedInfo.incomingGrailBtc.map(utxo => utxo.txid),
		...generalizedInfo.incomingUserBtc.map(payment => payment.txid),
		...generalizedInfo.incomingUserCharms.map(utxo => utxo.txid),
	];
	const previousTransactions =
		await context.bitcoinClient.getTransactionsMap(allPreviousTxids);

	const grailAddress = generateGrailPaymentAddress(
		nextGrailState,
		context.network
	);

	if (generalizedInfo.outgoingGrailBtc) {
		throw new Error(
			'outgoingGrailBtc should not be defined in generalizedInfo'
		);
	}

	generalizedInfo.outgoingGrailBtc = {
		amount: await calculateExcessBitcoin(
			context,
			previousTransactions,
			generalizedInfo
		),
		address: grailAddress,
	};
	// If under dust limit, just contribute it to the fee
	if (generalizedInfo.outgoingGrailBtc.amount < DUST_LIMIT) {
		generalizedInfo.outgoingGrailBtc.amount = 0;
	}

	// Sanity!
	await sanityCheck(context, previousTransactions, generalizedInfo);

	const fundingChangeAddress = await context.bitcoinClient.getAddress();
	fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());

	const previousSpellData = await showSpell(context, previousNftTxid);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, null, 2)
	);

	const previousPublicKeys = previousSpellData.outs[0].charms[
		'$0000'
	].current_cosigners.split(',') as string[];
	const previousThreshold = previousSpellData.outs[0].charms['$0000']
		.current_threshold as number;

	const previousGrailState: GrailState = {
		publicKeys: previousPublicKeys,
		threshold: previousThreshold,
	};

	const request: GeneralizedRequest = {
		appId: context.appId,
		appVk: context.appVk,
		ticker: context.ticker,
		fundingUtxo,
		fundingChangeAddress,
		feerate,
		previousNftTxid,
		previousGrailState,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: nextGrailState.publicKeys.join(','),
			threshold: nextGrailState.threshold,
		},
		generalizedInfo,

		toYamlObj: function () {
			return {
				version: 4,
				apps: {
					$00: `n/${this.appId}/${this.appVk}`,
					$01: `t/${this.appId}/${this.appVk}`,
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
								ticker: this.ticker,
								current_cosigners: this.previousGrailState.publicKeys.join(','),
								current_threshold: this.previousGrailState.threshold,
							},
						},
					},
					...this.generalizedInfo.incomingUserBtc.map(payment => ({
						utxo_id: `${payment.txid}:${payment.vout}`,
					})),
					...this.generalizedInfo.incomingGrailBtc.map(utxo => ({
						utxo_id: `${utxo.txid}:${utxo.vout}`,
					})),
					...this.generalizedInfo.incomingUserCharms.map(utxo => ({
						utxo_id: `${utxo.txid}:${utxo.vout}`,
					})),
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
					...this.generalizedInfo.outgoingUserBtc.map(outgoing => ({
						address: outgoing.address,
						amount: outgoing.amount,
						charms: {
							$00: {
								type: 'user_btc',
							},
						},
					})),
					...this.generalizedInfo.outgoingUserCharms.map(outgoing => ({
						address: outgoing.address,
						charms: {
							$00: {
								type: 'user_charms',
							},
							$01: {
								amount: outgoing.amount,
							},
						},
					})),
					this.generalizedInfo.outgoingGrailBtc!.amount > 0
						? {
								address: this.nextNftAddress,
								amount: this.generalizedInfo.outgoingGrailBtc!.amount,
								charms: {
									$00: {
										type: 'grail_btc',
									},
								},
							}
						: undefined,
				].filter(Boolean),
			};
		},
	};

	const spell = await createUpdatingSpell(
		context,
		request,
		allPreviousTxids,
		{ publicKeys: previousPublicKeys, threshold: previousThreshold },
		nextGrailState,
		generalizedInfo
	);
	previousTransactions[txBytesToTxid(spell.commitmentTxBytes)] =
		spell.commitmentTxBytes;

	const previousSpellMap = await getPreviousGrailStateMap(context, [
		...generalizedInfo.incomingGrailBtc.map(utxo => utxo.txid),
		...generalizedInfo.incomingUserCharms.map(utxo => utxo.txid),
	]);

	const signatureRequest: SignatureRequest = {
		transactionBytes: spell.spellTxBytes,
		previousTransactions,
		inputs: [
			{
				index: 0,
				state: previousGrailState,
				script: generateSpendingScriptForGrail(
					previousGrailState,
					context.network
				).script,
			},
			...generalizedInfo.incomingUserBtc.map(payment => ({
				index: 0,
				state: payment.grailState,
				script: generateSpendingScriptsForUserPayment(payment, context.network)
					.grail.script,
			})),
			...generalizedInfo.incomingGrailBtc.map(utxo => ({
				index: 0,
				state: previousSpellMap[utxo.txid],
				script: generateSpendingScriptForGrail(
					previousSpellMap[utxo.txid],
					context.network
				).script,
			})),
			...generalizedInfo.incomingUserCharms.map(payment => ({
				index: 0,
				state: payment.grailState,
				script: generateSpendingScriptsForUserPayment(payment, context.network)
					.grail.script,
			})),
		].map((input, index) => ({
			...input,
			index,
		})),
	};

	console.log('Spell created:', JSON.stringify(spell, bufferReplacer, 2));
	return { spell, signatureRequest };
}
