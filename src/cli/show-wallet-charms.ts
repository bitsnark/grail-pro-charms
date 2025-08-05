import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { Network } from '../core/taproot/taproot-common';
import { bufferReplacer } from '../core/json';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { TICKER, ZKAPP_BIN } from './consts';
import { findCharmsUtxos } from '../core/spells';
import { skip } from 'node:test';

export async function showWalletCharmsCli(
	_argv: string[]
): Promise<{ txid: string; vout: number; amount: number }[]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['mock-proof', 'skip-proof'],
		default: {
			network: 'regtest',
			amount: 666666,
			'mock-proof': false,
			'skip-proof': false,
		},
		'--': true,
	});

	const network = argv['network'] as Network;

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}
	const appVk = argv['app-vk'] as string;

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: ZKAPP_BIN,
		network: network,
		mockProof: !!argv['mock-proof'],
		skipProof: !!argv['skip-proof'],
		ticker: TICKER,
	});

	const utxos = await findCharmsUtxos(context, Number.MAX_VALUE);
	logger.debug('Found Charms UTXOs: ', utxos);
	return utxos;
}

if (require.main === module) {
	showWalletCharmsCli(process.argv.slice(2))
		.catch(error => {
			logger.error('Error during NFT update: ', error);
		})
		.then(result => process.exit(result ? 0 : 1));
}
