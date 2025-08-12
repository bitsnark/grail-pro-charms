import minimist from 'minimist';
import { logger } from '../core/logger';
import dotenv from 'dotenv';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { BitcoinClient } from '../core/bitcoin';
import { generateGrailPaymentAddress } from '../core/taproot';
import { DeployRequest, TokenDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { createSpell } from '../core/spells';
import { transmitSpell } from '../api/spell-operations';
import { parse } from '../core/env-parser';
import { DEFAULT_FEERATE, ZKAPP_BIN } from './consts';

export async function deployNft(
	context: IContext,
	tokenDetails: TokenDetails,
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
		tokenDetails,
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
								ticker: this.tokenDetails.ticker,
								name: this.tokenDetails.name,
								image: this.tokenDetails.image,
								url: this.tokenDetails.url,
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
		boolean: ['transmit', 'mock-proof', 'skip-proof'],
		default: {
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
			'skip-proof': false,
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

	const context = await Context.createForDeploy(
		{
			charmsBin: parse.string('CHARMS_BIN'),
			zkAppBin: ZKAPP_BIN,
			network:
				argv['network'] ?? (parse.string('BTC_NETWORK', 'regtest') as Network),
			mockProof: !!argv['mock-proof'],
			skipProof: !!argv['skip-proof'],
		},
		fundingUtxo
	);

	const tokenDetails: TokenDetails = {
		ticker: argv['ticker'],
		name: argv['token-name'],
		image: argv['token-image'],
		url: argv['token-url'],
	};

	const [_, spellTxid] = await deployNft(
		context,
		tokenDetails,
		deployerPublicKey,
		feerate,
		fundingUtxo,
		transmit
	);

	return {
		appId: context.appId,
		appVk: context.appVk,
		spellTxid,
	};
}

if (require.main === module) {
	deployNftCli(process.argv.slice(2)).catch(error => {
		logger.error('Error during NFT deployment: ', error);
	});
}
