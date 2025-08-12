import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import {
	getPreviousTransactions,
	transmitSpell,
} from '../api/spell-operations';
import { DEFAULT_FEERATE } from './consts';
import { createTransferSpell } from '../api/create-transfer-spell';
import { findCharmsUtxos } from '../core/spells';
import { createContext } from './utils';

export async function transferCli(_argv: string[]): Promise<[string, string]> {
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

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const context = await createContext(argv);

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
	logger.debug('Found Charms UTXOs: ', inputUtxos);

	const outputAddress =
		(argv['output-address'] as string) ?? (await bitcoinClient.getAddress());
	logger.debug('Output address: ', outputAddress);

	const changeAddress =
		(argv['change-address'] as string) ?? (await bitcoinClient.getAddress());
	logger.debug('Change address: ', changeAddress);

	const spell = await createTransferSpell(
		context,
		feerate,
		inputUtxos,
		outputAddress,
		changeAddress,
		amount,
		fundingUtxo
	);
	logger.debug('Spell created: ', spell);

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
	logger.debug(
		'Signed spell transaction bytes: ',
		spell.spellTxBytes.toString('hex')
	);

	if (transmit) {
		const transmittedTxids = await transmitSpell(context, spell);
		return transmittedTxids;
	}
	return ['', ''];
}

if (require.main === module) {
	transferCli(process.argv.slice(2)).catch(error => {
		logger.error(error);
	});
}
