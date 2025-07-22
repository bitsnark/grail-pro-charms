import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { generateUserPaymentAddress } from '../core/taproot';
import { generateRandomKeypair } from './generate-random-keypairs';
import { Network } from '../core/taproot/taproot-common';
import { setupLog } from '../core/log';
import { bufferReplacer } from '../core/json';

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
	if (!argv['current-public-keys']) {
		console.error('--current-public-keys is required.');
		return;
	}
	const currentPublicKeys = (argv['current-public-keys'] as string)
		.split(',')
		.map(pk => pk.trim());
	const currentThreshold = Number.parseInt(argv['current-threshold']);
	if (
		isNaN(currentThreshold) ||
		currentThreshold < 1 ||
		currentThreshold > currentPublicKeys.length
	) {
		console.error(
			'--current-threshold must be a number between 1 and the number of current public keys.'
		);
		return;
	}

	const amount = Number.parseInt(argv['amount']);
	if (!amount || isNaN(amount) || amount <= 0) {
		console.error('--amount must be a positive number.');
		return;
	}

	const bitcoinClient = await BitcoinClient.initialize();

	const recoveryKeypair = generateRandomKeypair();
	console.log(
		'Recovery keypair generated:',
		JSON.stringify(recoveryKeypair, bufferReplacer, 2)
	);

	const userPaymentAddress = generateUserPaymentAddress(
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		{
			recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
			timelockBlocks: 100,
		},
		network
	);

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
