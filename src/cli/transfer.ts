import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import {
	getPreviousTransactions,
	transmitSpell,
} from '../api/spell-operations';
import { DEFAULT_FEERATE } from './consts';
import { createTransferSpell } from '../api/create-transfer-spell';
import { findCharmsUtxos } from '../core/spells';
import { createContext, getFundingUtxo } from './utils';

export async function transferCli(_argv: string[]): Promise<[string, string]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['transmit', 'mock-proof', 'skip-proof'],
		default: {},
		'--': true,
	});

	const context = await createContext(argv);

	const feerate = Number.parseFloat(argv['feerate']) || DEFAULT_FEERATE;
	const transmit = argv['transmit'] as boolean;
	const fundingUtxo = await getFundingUtxo(context, feerate);

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
		(argv['output-address'] as string) ??
		(await context.bitcoinClient.getAddress());
	logger.debug('Output address: ', outputAddress);

	const changeAddress =
		(argv['change-address'] as string) ??
		(await context.bitcoinClient.getAddress());
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

	spell.spellTxBytes = await context.bitcoinClient.signTransaction(
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
