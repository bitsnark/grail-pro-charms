import { logger } from '../core/logger';
import * as bitcoin from 'bitcoinjs-lib';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { generateUserPaymentAddress } from '../core/taproot';
import { generateRandomKeypair } from './generate-random-keypairs';
import { Network } from '../core/taproot/taproot-common';
import { TIMELOCK_BLOCKS } from './pegin';
import { findCharmsUtxos } from '../core/spells';
import { IContext } from '../core/i-context';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { DEFAULT_FEERATE, ZKAPP_BIN } from './consts';
import { createTransmitSpell } from '../api/create-transmit-spell';
import { getPreviousTransactions, transmitSpell } from '../api/spell-operations';
import { GrailState } from '../core/types';
import { hashToTxid } from '../core/bitcoin';

export async function sendUserPaymentCharms(
	context: IContext,
	feerate: number,
	grailState: GrailState,
	amount: number,
	changeAddress: string,
	network: Network
): Promise<{ txid: string; recoveryPublicKey: string }> {
	const recoveryKeypair = generateRandomKeypair();

	const userPaymentAddress = generateUserPaymentAddress(
		grailState,
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
	logger.debug('Found Charms UTXOs: ', charmsUtxos);

	logger.debug('Sending charms to user payment address: ', userPaymentAddress);
	const spell = await createTransmitSpell(
		context,
		feerate,
		charmsUtxos,
		userPaymentAddress,
		changeAddress,
		amount
	);

	const tx = bitcoin.Transaction.fromHex(spell.spellTxBytes.toString('hex'));
	const prevTxids = tx.ins.map(input => hashToTxid(input.hash));
	console.log('Previous transaction IDs: ', prevTxids);
	const previousTransactions = await getPreviousTransactions(
		context,
		spell.spellTxBytes,
		spell.commitmentTxBytes
	);
	console.log('Previous transactions: ', previousTransactions);
	spell.spellTxBytes = await context.bitcoinClient.signTransaction(
		spell.spellTxBytes,
		previousTransactions
	);

	const [_, spellTxid] = await transmitSpell(context, spell);

	return {
		txid: spellTxid,
		recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
	};
}

export async function sendUserPaymentBtc(
	context: IContext,
	grailState: GrailState,
	amount: number,
	network: Network
): Promise<{ txid: string; recoveryPublicKey: string }> {
	const recoveryKeypair = generateRandomKeypair();

	const userPaymentAddress = generateUserPaymentAddress(
		grailState,
		{
			recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
			timelockBlocks: TIMELOCK_BLOCKS,
		},
		network
	);

	logger.debug('Sending funds to user payment address: ', userPaymentAddress);
	const txid = await context.bitcoinClient.fundAddress(
		userPaymentAddress,
		amount
	);
	logger.debug('Funds sent successfully, txid: ', txid);
	logger.debug('Recovery public key: ', recoveryKeypair.publicKey.toString('hex'));

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
			feerate: DEFAULT_FEERATE,
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

	const grailState = {
		publicKeys: currentPublicKeys,
		threshold: currentThreshold,
	};

	const amount = Number.parseInt(argv['amount']);
	if (!amount || isNaN(amount) || amount <= 0) {
		throw new Error('--amount must be a positive number.');
	}

	const feerate = Number.parseFloat(argv['feerate']);

	const type = argv['type'] as string;
	if (type !== 'charms' && type !== 'btc') {
		throw new Error('--type must be either "charms" or "btc".');
	}

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required.');
	}
	const appVk = argv['app-vk'] as string;
	if (!appVk) {
		throw new Error('--app-vk is required.');
	}

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: ZKAPP_BIN,
		network,
		mockProof: !!argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	if (type == 'charms') {
		const changeAddress = await context.bitcoinClient.getAddress();
		return await sendUserPaymentCharms(
			context,
			feerate,
			grailState,
			amount,
			changeAddress,
			network
		);
	} else if (type == 'btc') {
		return await sendUserPaymentBtc(context, grailState, amount, network);
	} else throw new Error('Invalid type specified. Use "charms" or "btc".');
}

if (require.main === module) {
	userPaymentCli(process.argv.slice(2))
		.catch(error => {
			logger.error('Error during NFT update: ', error);
		})
		.then(result => {
			if (result) {
				logger.log('User payment created successfully: ', result);
			} else {
				logger.error('User payment creation failed.');
			}
			process.exit(result ? 0 : 1);
		});
}
