import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import { setupLog } from '../core/log';
import { parse } from '../core/env-parser';
import { Context } from '../core/context';
import { Network } from '../core/taproot/taproot-common';

async function viewNft(context: IContext, nftTxid: string) {
	const bitcoinClient = await BitcoinClient.initialize();

	const txhex = await bitcoinClient.getTransactionHex(nftTxid);
	if (!txhex) {
		console.error(`Transaction ${nftTxid} not found`);
		return;
	}
	const spell = await showSpell(context, txhex);
	console.log('spell: ' + JSON.stringify(spell, null, '\t'));
}

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			'nft-txid':
				'509697aaa6bc0807dc00ebd8600d38c4879c66d8d79e426023861ba1a0e76769',
		},
	});

	const nftTxid = argv['nft-txid'];

	if (!nftTxid) {
		console.error('Please provide the NFT transaction ID using --nft-txid');
		process.exit(1);
	}

	const context = await Context.create({
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network: argv['network'] as Network,
		mockProof: argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	await viewNft(context, nftTxid).catch(error => {
		console.error('Error viewing NFT:', error);
	});
}

if (require.main === module) {
	main().catch(error => {
		console.error('Error during NFT view:', error);
	});
}
