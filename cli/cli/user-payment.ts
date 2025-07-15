import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { generateUserPaymentAddress } from '../core/taproot';
import config from '../config';
import { generateRandomKeypair } from './generate-random-keypairs';
import { Network } from '../core/taproot/taproot-common';

async function main() {
	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			network: config.network,
			'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
			'current-threshold': 1,
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
			timelockBlocks: config.userTimelockBlocks,
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
