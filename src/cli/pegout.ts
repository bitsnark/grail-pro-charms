import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { bufferReplacer } from '../core/json';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { SignatureResponse, UserPaymentDetails } from '../core/types';
import {
	findUserPaymentVout,
	getUserWalletAddressFromUserPaymentUtxo,
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
} from '../api/spell-operations';
import { privateToKeypair } from './generate-random-keypairs';
import { createPegoutSpell } from '../api/create-pegout-spell';
import { TIMELOCK_BLOCKS } from './pegin';
import { DEFAULT_FEERATE } from './consts';

export async function pegoutCli(_argv: string[]): Promise<[string, string]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		string: ['new-public-keys', 'private-keys'],
		boolean: ['transmit', 'mock-proof'],
		default: {
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
		},
		'--': true,
	});

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}
	const appVk = argv['app-vk'] as string;
	if (appVk === undefined) {
		throw new Error('--app-vk is required');
	}

	const network = argv['network'] as Network;

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network: argv['network'] as Network,
		mockProof: argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	if (!argv['new-public-keys']) {
		throw new Error('--new-public-keys is required');
	}
	const newPublicKeys = (argv['new-public-keys'] as string)
		.split(',')
		.map(pk => pk.trim().replace('0x', ''));
	const newThreshold = Number.parseInt(argv['new-threshold']);
	if (
		isNaN(newThreshold) ||
		newThreshold < 1 ||
		newThreshold > newPublicKeys.length
	) {
		throw new Error(
			'Invalid new threshold. It must be a number between 1 and the number of public keys.'
		);
	}

	const previousNftTxid = argv['previous-nft-txid'] as string;
	if (!previousNftTxid) {
		throw new Error('--previous-nft-txid is required');
	}

	const transmit = !!argv['transmit'];

	if (!argv['private-keys']) {
		throw new Error('--private-keys is required');
	}
	const privateKeys = (argv['private-keys'] as string)
		.split(',')
		.map(s => s.trim().replace('0x', ''));

	if (!argv['user-payment-txid']) {
		throw new Error('--user-payment-txid is required');
	}
	if (!argv['recovery-public-key']) {
		throw new Error('--recovery-public-key is required');
	}
	const recoveryPublicKey = (argv['recovery-public-key'] as string).replace(
		'0x',
		''
	);

	const newGrailState = {
		publicKeys: newPublicKeys,
		threshold: newThreshold,
	};

	const userPaymentTxid = argv['user-payment-txid'] as string;
	if (!userPaymentTxid) {
		throw new Error('--user-payment-txid is required');
	}
	const userPaymentVout = await findUserPaymentVout(
		context,
		newGrailState,
		userPaymentTxid,
		recoveryPublicKey,
		TIMELOCK_BLOCKS
	);

	const userWalletAddress = await getUserWalletAddressFromUserPaymentUtxo(
		context,
		{ txid: userPaymentTxid, vout: userPaymentVout },
		network
	);

	const userPaymentDetails: UserPaymentDetails = {
		txid: userPaymentTxid,
		vout: userPaymentVout,
		recoveryPublicKey,
		timelockBlocks: TIMELOCK_BLOCKS,
		grailState: newGrailState,
		userWalletAddress,
	};

	const feerate = Number.parseFloat(argv['feerate']);

	const { spell, signatureRequest } = await createPegoutSpell(
		context,
		feerate,
		previousNftTxid,
		newGrailState,
		userPaymentDetails,
		fundingUtxo
	);
	logger.log('Spell created:', JSON.stringify(spell, bufferReplacer, 2));
	logger.log(
		'Signature request:',
		JSON.stringify(signatureRequest, bufferReplacer, 2)
	);

	const fromCosigners: SignatureResponse[] = privateKeys
		.map(pk => Buffer.from(pk, 'hex'))
		.map(privateKey => {
			const keypair = privateToKeypair(privateKey);
			const signatures = signAsCosigner(context, signatureRequest, keypair);
			return { publicKey: keypair.publicKey.toString('hex'), signatures };
		});

	logger.log(
		'Signing spell with cosigners:',
		JSON.stringify(fromCosigners, bufferReplacer, 2)
	);

	const signedSpell = await injectSignaturesIntoSpell(
		context,
		spell,
		signatureRequest,
		fromCosigners
	);
	logger.log('Signed spell:', JSON.stringify(signedSpell, bufferReplacer, 2));

	if (transmit) {
		return await transmitSpell(context, signedSpell);
	}
	return ['', ''];
}

if (require.main === module) {
	pegoutCli(process.argv.slice(2)).catch(err => {
		logger.error(err);
	});
}
