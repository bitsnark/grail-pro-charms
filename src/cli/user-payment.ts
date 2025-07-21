import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { generateUserPaymentAddress } from '../core/taproot';
import { generateRandomKeypair } from './generate-random-keypairs';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { setupLog } from '../core/log';

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			network: 'regtest',
			amount: 666666,
		},
		'--': true,
	});

	const network = argv['network'] as Network;
	const currentPublicKeys = (argv['current-public-keys'] as string)
		.split(',')
		.map(pk => pk.trim());
	const currentThreshold = Number.parseInt(argv['current-threshold']);
	const amount = Number.parseInt(argv['amount']);

	const bitcoinClient = await BitcoinClient.create();

	const recoveryKeypair = generateRandomKeypair();

	const userPaymentAddress = generateUserPaymentAddress(
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		{
			recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
			timelockBlocks: 100,
		},
		network
	);

	const context = await Context.create({
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network: argv['network'] as Network,
		mockProof: argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	console.log('Sending funds to user payment address:', userPaymentAddress);
	const txid = await bitcoinClient.fundAddress(userPaymentAddress, amount);
	console.log('Funds sent successfully, txid: ', txid);
	console.log(
		'Recovery public key:',
		recoveryKeypair.publicKey.toString('hex')
	);
}

if (require.main === module) {
	main().catch(error => {
		console.error('Error during NFT update:', error);
	});
}
