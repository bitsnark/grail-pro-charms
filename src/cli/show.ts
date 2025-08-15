import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import { createContext } from './utils';

async function viewNft(context: IContext, nftTxid: string) {
	const bitcoinClient = await BitcoinClient.initialize();

	const txhex = await bitcoinClient.getTransactionHex(nftTxid);
	if (!txhex) {
		logger.error(`Transaction ${nftTxid} not found`);
		return;
	}
	const spell = await showSpell(context, txhex);
	logger.debug('spell: ', spell);
}

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			'nft-txid':
				'509697aaa6bc0807dc00ebd8600d38c4879c66d8d79e426023861ba1a0e76769',
		},
	});

	const nftTxid = argv['nft-txid'];

	if (!nftTxid) {
		logger.error('Please provide the NFT transaction ID using --nft-txid');
		process.exit(1);
	}

	const context = await createContext(argv);

	await viewNft(context, nftTxid).catch(error => {
		logger.error('Error viewing NFT: ', error);
	});
}

if (require.main === module) {
	main().catch(error => {
		logger.error('Error during NFT view: ', error);
	});
}
