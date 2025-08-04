import { logger } from '../core/logger';
import { BitcoinClient } from '../core/bitcoin';
import {
	Spell,
	TokenUtxo,
	TransmitRequest,
	Utxo,
} from '../core/types';
import { IContext } from '../core/i-context';
import { createSpell } from '../core/spells';
import { bufferReplacer } from '../core/json';

export async function createTransmitSpell(
	context: IContext,
	feerate: number,
	inputUtxos: TokenUtxo[],
	outputAddress: string,
	changeAddress: string,
	amount: number,
	fundingUtxo?: Utxo
): Promise<Spell> {
	const bitcoinClient = await BitcoinClient.initialize();

	if (!fundingUtxo) {
		fundingUtxo = await bitcoinClient.getFundingUtxo();
	}

	const inputTotal = inputUtxos.reduce((sum, utxo) => sum + utxo.amount, 0);
	const changeAmount = inputTotal - amount;
	if (changeAmount < 0) {
		throw new Error('Insufficient input UTXOs for the specified amount.');
	}

  const fundingChangeAddress = await context.bitcoinClient.getAddress();

	const request: TransmitRequest = {
		appId: context.appId,
		appVk: context.appVk,
		inputUtxos,
		outputAddress,
		changeAddress,
		amount,
		feerate,
		changeAmount,
		fundingChangeAddress,
		fundingUtxo,
		toYamlObj: function () {
			return {
				version: 4,
				apps: {
					$00: `t/${this.appId}/${this.appVk}`,
				},
				public_inputs: {
					$00: { action: 'transmit' },
				},
				ins: [
					...this.inputUtxos.map(utxo => ({
						utxo_id: `${utxo.txid}:${utxo.vout}`,
						charms: {
							$00: {
								amount: utxo.amount,
							},
						},
					})),
				],
				outs: [
					{
						address: this.outputAddress,
						charms: {
							$00: {
								amount: this.amount,
							},
						},
					},
					this.changeAmount > 0
						? {
								address: this.changeAddress,
								charms: {
									$00: {
										amount: this.changeAmount,
									},
								},
							}
						: null,
				].filter(Boolean),
			};
		},
	};

	const previousTxids = inputUtxos.map(utxo => utxo.txid);
	const spell = await createSpell(context, previousTxids, request);
	logger.debug(
		'Transmit spell created:',
		spell
	);

	return spell;
}
