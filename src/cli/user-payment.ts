import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { generateUserPaymentAddress } from '../core/taproot';
import { generateRandomKeypair } from './generate-random-keypairs';
import { Network } from '../core/taproot/taproot-common';
import { TIMELOCK_BLOCKS } from './pegin';
import { findCharmsUtxos } from '../core/spells';
import { IContext } from '../core/i-context';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { ZKAPP_BIN } from './consts';

export async function sendUserPaymentCharms(
	context: IContext,
	currentPublicKeys: string[],
	currentThreshold: number,
	amount: number,
	network: Network
): Promise<{ txid: string; recoveryPublicKey: string }> {
	const bitcoinClient = await BitcoinClient.initialize();

	const recoveryKeypair = generateRandomKeypair();

	const userPaymentAddress = generateUserPaymentAddress(
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		{
			recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
			timelockBlocks: TIMELOCK_BLOCKS,
		},
		network
	);

	const charmsUtxos = await findCharmsUtxos(context, amount);
	if (charmsUtxos.length === 0) {
		throw new Error('No sufficient Charms UTXOs found for user payment.');
	}
	
	console.log('Sending funds to user payment address:', userPaymentAddress);
	const txid = await bitcoinClient.fundAddress(userPaymentAddress, amount);
	console.log('Funds sent successfully, txid: ', txid);
	console.log(
		'Recovery public key:',
		recoveryKeypair.publicKey.toString('hex')
	);

	return { txid, recoveryPublicKey: recoveryKeypair.publicKey.toString('hex') };
}

export async function sendUserPaymentBtc(
	currentPublicKeys: string[],
	currentThreshold: number,
	amount: number,
	network: Network
): Promise<{ txid: string; recoveryPublicKey: string }> {
	const bitcoinClient = await BitcoinClient.initialize();

	const recoveryKeypair = generateRandomKeypair();

	const userPaymentAddress = generateUserPaymentAddress(
		{ publicKeys: currentPublicKeys, threshold: currentThreshold },
		{
			recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
			timelockBlocks: TIMELOCK_BLOCKS,
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

	return { txid, recoveryPublicKey: recoveryKeypair.publicKey.toString('hex') };
}

export async function userPaymentCli(
	_argv: string[]
): Promise<{ txid: string; recoveryPublicKey: string }> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		boolean: ['mock-proof'],
		default: {
			network: 'regtest',
			'mock-proof': false,
		},
		'--': true,
	});

	const network = argv['network'] as Network;
	if (!argv['current-public-keys']) {
		throw new Error('--current-public-keys is required.');
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
		throw new Error(
			'--current-threshold must be a number between 1 and the number of current public keys.'
		);
	}

	const amount = Number.parseInt(argv['amount']);
	if (!amount || isNaN(amount) || amount <= 0) {
		throw new Error('--amount must be a positive number.');
	}

	const type = argv['type'] as string;
	if (type && type !== 'charms' && type !== 'btc') {
		throw new Error('--type must be either "charms" or "btc".');
	}

	if (type == 'charms') {
		const context = await Context.create({
			charmsBin: parse.string('CHARMS_BIN'),
			zkAppBin: ZKAPP_BIN,
			network,
			mockProof: !!argv['mock-proof'],
			ticker: 'GRAIL-NFT',
		});
		return await sendUserPaymentCharms(
			context,
			currentPublicKeys,
			currentThreshold,
			amount,
			network
		);
	} else {
		return await sendUserPaymentBtc(
			currentPublicKeys,
			currentThreshold,
			amount,
			network
		);
	}
}

if (require.main === module) {
	userPaymentCli(process.argv.slice(2))
		.catch(error => {
			console.error('Error during NFT update:', error);
		})
		.then(result => {
			if (result) {
				console.log('User payment created successfully:', result);
			} else {
				console.error('User payment creation failed.');
			}
			process.exit(result ? 0 : 1);
		});
}
