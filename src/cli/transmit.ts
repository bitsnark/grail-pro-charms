import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import {
	getPreviousTransactions,
	transmitSpell,
} from '../api/spell-operations';
import { bufferReplacer } from '../core/json';
import { DEFAULT_FEERATE, TICKER, ZKAPP_BIN } from './consts';
import { createTransmitSpell } from '../api/create-transmit-spell';
import { findCharmsUtxos } from '../core/spells';

export async function transmitCli(_argv: string[]): Promise<[string, string]> {
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

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}
	const appVk = argv['app-vk'] as string;

	const network = argv['network'] as Network;

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: ZKAPP_BIN,
		network: network,
		mockProof: argv['mock-proof'],
		ticker: TICKER,
	});

	const transmit = !!argv['transmit'];

	const feerate = Number.parseFloat(argv['feerate']);
	if (isNaN(feerate) || feerate <= 0) {
		throw new Error('--feerate must be a positive number.');
	}

	const amount = Number.parseInt(argv['amount']);
	if (!amount || isNaN(amount) || amount <= 0) {
		throw new Error('--amount must be a positive number.');
	}

	const inputUtxos = await findCharmsUtxos(context, amount);
	if (inputUtxos.length === 0) {
		throw new Error('No Charms UTXOs found for the specified amount.');
	}
	logger.log('Found Charms UTXOs:', inputUtxos);

	const outputAddress =
		(argv['output-address'] as string) ?? (await bitcoinClient.getAddress());
	logger.log('Output address:', outputAddress);

	const changeAddress =
		(argv['change-address'] as string) ?? (await bitcoinClient.getAddress());
	logger.log('Change address:', changeAddress);

	const spell = await createTransmitSpell(
		context,
		feerate,
		inputUtxos,
		outputAddress,
		changeAddress,
		amount,
		fundingUtxo
	);
	logger.log('Spell created:', JSON.stringify(spell, bufferReplacer, 2));

	const previousTransactionsMap = await getPreviousTransactions(
		context,
		spell.spellTxBytes,
		spell.commitmentTxBytes
	);

	spell.spellTxBytes = await bitcoinClient.signTransaction(
		spell.spellTxBytes,
		previousTransactionsMap,
		'ALL|ANYONECANPAY'
	);
	logger.log(
		'Signed spell transaction bytes:',
		spell.spellTxBytes.toString('hex')
	);

	if (transmit) {
		const transmittedTxids = await transmitSpell(context, spell);
		// if (network === 'regtest') {
		// 	await context.bitcoinClient.generateBlocks(transmittedTxids);
		// }
		return transmittedTxids;
	}
	return ['', ''];
}

if (require.main === module) {
	transmitCli(process.argv.slice(2)).catch(error => {
		logger.error(error);
	});
}
