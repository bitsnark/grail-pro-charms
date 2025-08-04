import minimist from 'minimist';
import { logger } from '../core/logger';
import dotenv from 'dotenv';
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
import { DEFAULT_FEERATE, TICKER, ZKAPP_BIN } from './consts';

export async function deployNft(
	context: IContext,
	deployerPublicKey: Buffer,
	feerate: number,
	fundingUtxo: Utxo,
	transmit: boolean = false
): Promise<[string, string]> {
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
		appId: context.appId,
		appVk: context.appVk,
		fundingUtxo,
		fundingChangeAddress,
		feerate,
		nextNftAddress: grailAddress,
		ticker: context.ticker,
		currentNftState: {
			publicKeysAsString: initialNftState.publicKeys.join(','),
			threshold: initialNftState.threshold,
		},

		toYamlObj: function () {
			return {
				version: 4,
				apps: { $00: `n/${this.appId}/${this.appVk}` },
				private_inputs: {
					$00: `${this.fundingUtxo.txid}:${this.fundingUtxo.vout}`,
				},
				public_inputs: { $00: { action: 'deploy' } },
				ins: [],
				outs: [
					{
						address: this.nextNftAddress,
						charms: {
							$00: {
								ticker: this.ticker,
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
	logger.debug('Spell created: ', spell);

	if (transmit) {
		return await transmitSpell(context, spell);
	}
	return ['', ''];
}

export async function deployNftCli(
	_argv: string[]
): Promise<{ appId: string; appVk: string; spellTxid: string }> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['transmit', 'mock-proof'],
		default: {
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
		},
		'--': true,
	});

	if (!argv['deployer-public-key']) {
		throw new Error('--deployerPublicKey is required');
	}
	const deployerPublicKey = Buffer.from(
		(argv['deployer-public-key'] as string).trim().replace('0x', ''),
		'hex'
	);

	if (!argv['feerate']) {
		throw new Error('--feerate is required');
	}
	const feerate = Number.parseFloat(argv['feerate']);
	const transmit = !!argv['transmit'];

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const network = argv['network'] as Network;

	const context = await Context.createForDeploy(
		{
			charmsBin: parse.string('CHARMS_BIN'),
			zkAppBin: ZKAPP_BIN,
			network: network,
			mockProof: !!argv['mock-proof'],
			ticker: TICKER,
		},
		fundingUtxo
	);

	const [_, spellTxid] = await deployNft(
		context,
		deployerPublicKey,
		feerate,
		fundingUtxo,
		transmit
	);

	// if (network === 'regtest') {
	// 	await context.bitcoinClient.generateBlocks([commitTxid, spellTxid]);
	// }

	return {
		appId: context.appId,
		appVk: context.appVk,
		spellTxid
	};
}

if (require.main === module) {
	deployNftCli(process.argv.slice(2))
		.catch(error => {
			logger.error('Error during NFT deployment: ', error);
		});
}
