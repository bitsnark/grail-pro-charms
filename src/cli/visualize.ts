import minimist from 'minimist';
import fs from 'node:fs';
import { logger } from '../core/logger';
import dotenv from 'dotenv';
import { DEFAULT_FEERATE } from './consts';
import { dot } from '../visualize/dot';
import { exec } from 'child_process';
import { crawlBack, crawlForward } from '../visualize/crawl';
import { createContext } from './utils';

export async function visualizeCli(_argv: string[]): Promise<void> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['mock-proof', 'skip-proof'],
		default: {
			'app-id':
				'38237bc376ecd951371525b2e8d866812b13eac0690a9102be9383dfc1d21d5e',
			'app-vk':
				'ecd9cf39a2115c72344b2842e944756dcfd8ea31c10ead2f58bc7f2f8afd2560',
			txid: 'ab3ed21aba3f039f327540217408e6495c07a353933ee696bb6a7b49a7d7cd64',
			outfile: 'visualize.dot',
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
			'skip-proof': false,
			'max-depth': 10,
		},
		'--': true,
	});

	const context = await createContext(argv);

	const txid = argv['txid'] as string;
	if (!txid) {
		logger.error('--txid is required');
		return;
	}

	const outfile = argv['outfile'] as string;
	if (!outfile) {
		logger.error('--outfile is required');
		return;
	}

	const maxDepth = parseInt(argv['max-depth'] as string, 10);
	if (isNaN(maxDepth) || maxDepth < 1) {
		logger.error('--max-depth must be a positive integer');
		return;
	}

	const transactionInfoMap = await crawlBack(context, maxDepth, txid);
	await crawlForward(context, maxDepth, txid, transactionInfoMap);

	const dotFile = outfile.replace('.svg', '') + '.dot';

	// Open a write stream to the output file
	const fileWriter = fs.createWriteStream(dotFile, { flags: 'w' });
	const out = { log: (s: string) => fileWriter.write(s + '\n') };
	await dot(context, txid, transactionInfoMap, out);
	fileWriter.close();

	return new Promise<void>((resolve, reject) => {
		exec(`dot -Tsvg ${dotFile} -o ${outfile}`, (error, stdout, stderr) => {
			if (error) {
				logger.error(`Error generating SVG: ${error.message}`);
				reject(error);
			}
			if (stderr) logger.warn(stderr);
			logger.debug(stdout);
			resolve();
		});
	});
}

if (require.main === module) {
	visualizeCli(process.argv.slice(2)).catch(error => {
		logger.error(error);
	});
}
