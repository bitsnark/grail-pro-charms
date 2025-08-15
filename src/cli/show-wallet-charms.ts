import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { findCharmsUtxos } from '../core/spells';
import { createContext } from './utils';

export async function showWalletCharmsCli(
	_argv: string[]
): Promise<{ txid: string; vout: number; amount: number }[]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['mock-proof', 'skip-proof'],
		default: {},
		'--': true,
	});

	const context = await createContext(argv);

	const utxos = await findCharmsUtxos(context, Number.MAX_VALUE);
	logger.debug('Found Charms UTXOs: ', utxos);
	return utxos;
}

if (require.main === module) {
	showWalletCharmsCli(process.argv.slice(2))
		.then(result => process.exit(result ? 0 : 2))
		.catch(error => {
			logger.error(error);
			process.exit(1);
		});
}
