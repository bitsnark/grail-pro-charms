import { BitcoinClient } from '../core/bitcoin';
import { generateGrailPaymentAddress } from '../core/taproot';
import { GrailState, Spell, UpdateRequest, Utxo } from '../core/types';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import { createUpdatingSpell } from './spell-operations';

export async function createUpdateNftSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	grailState: GrailState,
	fundingUtxo?: Utxo
): Promise<Spell> {
	const bitcoinClient = await BitcoinClient.initialize();

	const grailAddress = generateGrailPaymentAddress(grailState, context.network);
	const fundingChangeAddress = await bitcoinClient.getAddress();

	if (!fundingUtxo) {
		fundingUtxo = await bitcoinClient.getFundingUtxo();
	}

	const previousNftTxhex =
		await bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}
	const previousSpellData = await showSpell(context, previousNftTxhex);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, null, '\t')
	);
	if (!previousSpellData) {
		throw new Error('Invalid previous NFT spell data');
	}

	const previousPublicKeys =
		previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
	const previousThreshold =
		previousSpellData.outs[0].charms['$0000'].current_threshold;

	const request: UpdateRequest = {
		fundingUtxo,
		fundingChangeAddress,
		feerate,
		previousNftTxid,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: grailState.publicKeys.join(','),
			threshold: grailState.threshold,
		},

		toYamlObj: function () {
			return {
				version: 4,
				apps: { $00: `n/${context.appId}/${context.appVk}` },
				public_inputs: { $00: { action: 'update' } },
				ins: [
					{
						utxo_id: `${previousNftTxid}:0`,
						charms: {
							$00: {
								ticker: context.ticker,
								current_cosigners: previousPublicKeys,
								current_threshold: previousThreshold,
							},
						},
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
				],
			};
		},
	};

	return await createUpdatingSpell(
		context,
		request,
		[previousNftTxid],
		{ publicKeys: previousPublicKeys, threshold: previousThreshold },
		grailState,
		null
	);
}
