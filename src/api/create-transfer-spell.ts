import { logger } from '../core/logger';
import { Spell, TokenUtxo, TransferRequest, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { createSpell } from '../core/spells';
import { getFundingUtxo } from './spell-operations';

export async function createTransferSpell(
	context: IContext,
	feerate: number,
	inputUtxos: TokenUtxo[],
	outputAddress: string,
	changeAddress: string,
	amount: number,
	fundingUtxo?: Utxo
): Promise<Spell> {
	if (!fundingUtxo)
		fundingUtxo = await getFundingUtxo(context.bitcoinClient, feerate);

	const inputTotal = inputUtxos.reduce((sum, utxo) => sum + utxo.amount, 0);
	if (inputUtxos.length == 0 || inputTotal <= 0) {
		throw new Error('No input UTXOs provided or all amounts are zero.');
	}

	const changeAmount = inputTotal - amount;
	if (changeAmount < 0) {
		throw new Error('Insufficient input UTXOs for the specified amount.');
	}

	const fundingChangeAddress = await context.bitcoinClient.getAddress();

	const request: TransferRequest = {
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
					$00: { action: 'transfer' },
				},
				ins: [
					...this.inputUtxos.map(utxo => ({
						utxo_id: `${utxo.txid}:${utxo.vout}`,
						charms: { $00: utxo.amount },
					})),
				],
				outs: [
					{
						address: this.outputAddress,
						charms: { $00: this.amount },
					},
					this.changeAmount > 0
						? {
								address: this.changeAddress,
								charms: { $00: this.changeAmount },
							}
						: null,
				].filter(Boolean),
			};
		},
	};

	const previousTxids = inputUtxos.map(utxo => utxo.txid);
	const spell = await createSpell(context, previousTxids, request);
	logger.debug('Transmit spell created:', spell);

	return spell;
}
