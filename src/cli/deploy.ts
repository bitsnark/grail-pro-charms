import minimist from 'minimist';
import dotenv from 'dotenv';
import { setupLog } from '../core/log';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { BitcoinClient } from '../core/bitcoin';
import { generateGrailPaymentAddress } from '../core/taproot';
import { DeployRequest, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { createSpell } from '../core/spells';
import { transmitSpell } from '../api/spell-operations';
import { parse } from '../core/env-parser';
import { bufferReplacer } from '../core/json';

export async function deployNft(
	context: IContext,
	deployerPublicKey: Buffer,
	feeRate: number,
	fundingUtxo: Utxo,
	transmit: boolean = false
): Promise<void> {
	const initialNftState = {
		publicKeys: [deployerPublicKey.toString('hex')],
		threshold: 1,
	};

	const grailAddress = generateGrailPaymentAddress(
		initialNftState,
		context.network
	);
	const fundingChangeAddress = await context.bitcoinClient.getAddress();

	const request: DeployRequest = {
		fundingUtxo,
		fundingChangeAddress,
		feeRate,
		nextNftAddress: grailAddress,
		currentNftState: {
			publicKeysAsString: initialNftState.publicKeys.join(','),
			threshold: initialNftState.threshold,
		},

		toYamlObj: function () {
			return {
				version: 4,
				apps: { $00: `n/${context.appId}/${context.appVk}` },
				private_inputs: { $00: `${fundingUtxo.txid}:${fundingUtxo.vout}` },
				public_inputs: { $00: { action: 'deploy' } },
				ins: [],
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

	const spell = await createSpell(context, [], request);
	console.log('Spell created:', JSON.stringify(spell, bufferReplacer, '\t'));

	if (transmit) {
		await transmitSpell(context, spell);
	}
}

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		string: ['deployerPublicKey'],
		boolean: ['transmit', 'mock-proof'],
		default: {
			network: 'regtest',
			feerate: 0.002,
			transmit: true,
			'mock-proof': false,
		},
		'--': true,
	});

	if (!argv['deployerPublicKey']) {
		console.error('--deployerPublicKey is required');
		return;
	}
	const deployerPublicKey = Buffer.from(
		(argv['deployerPublicKey'] as string).trim().replace('0x', ''),
		'hex'
	);
	const feeRate = Number.parseFloat(argv['feerate']);
	const transmit = !!argv['transmit'];

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const context = await Context.createForDeploy(
		{
			charmsBin: parse.string('CHARMS_BIN'),
			zkAppBin: './zkapp/target/charms-app',
			network: argv['network'] as Network,
			mockProof: argv['mock-proof'],
			ticker: 'GRAIL-NFT',
		},
		fundingUtxo
	);

	await deployNft(context, deployerPublicKey, feeRate, fundingUtxo, transmit);
}

if (require.main === module) {
	main().catch(error => {
		console.error('Error during NFT deployment:', error);
	});
}
