import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { SignatureResponse } from '../core/types';
import {
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
} from '../api/spell-operations';
import { privateToKeypair } from './generate-random-keypairs';
import { DEFAULT_FEERATE } from './consts';
import { filterValidCosignerSignatures } from '../api/spell-operations';
import { createMintSpell } from '../api/create-mint-spell';

export const TIMELOCK_BLOCKS = 100; // Default timelock for user payments

export async function mintCli(_argv: string[]): Promise<[string, string]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		string: ['private-keys', 'user-wallet-address'],
		boolean: ['transmit', 'mock-proof', 'skip-proof'],
		default: {
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
			'skip-proof': false,
			'user-payment-vout': 0,
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

	const network = argv['network'] as Network;

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network,
		mockProof: !!argv['mock-proof'],
		skipProof: !!argv['skip-proof'],
		ticker: 'GRAIL-NFT',
	});

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

	const userWalletAddress =
		(argv['user-wallet-address'] as string) ||
		(await context.bitcoinClient.getAddress());

	if (!argv['feerate']) {
		throw new Error('--feerate is required');
	}
	const feerate = Number.parseFloat(argv['feerate']);

	const amount = Number.parseInt(argv['amount'] as string, 10);
	if (!amount || isNaN(amount) || amount <= 0) {
		throw new Error('--amount is required and must be a valid number');
	}

	const { spell, signatureRequest } = await createMintSpell(
		context,
		feerate,
		previousNftTxid,
		amount,
		userWalletAddress,
		fundingUtxo
	);
	logger.debug('Spell created: ', spell);

	const fromCosigners: SignatureResponse[] = privateKeys
		.map(pk => Buffer.from(pk, 'hex'))
		.map(privateKey => {
			const keypair = privateToKeypair(privateKey);
			const signatures = signAsCosigner(context, signatureRequest, keypair);
			return { publicKey: keypair.publicKey.toString('hex'), signatures };
		});
	logger.debug('Signature responses from cosigners: ', fromCosigners);

	const filteredSignatures = fromCosigners.map(response => ({
		...response,
		signatures: filterValidCosignerSignatures(
			context,
			signatureRequest,
			response.signatures,
			Buffer.from(response.publicKey, 'hex')
		),
	}));
	logger.debug(
		'Signature responses from cosigners after fiultering: ',
		filteredSignatures
	);

	const signedSpell = await injectSignaturesIntoSpell(
		context,
		spell,
		signatureRequest,
		filteredSignatures
	);
	logger.debug('Signed spell: ', signedSpell);

	if (transmit) {
		const transmittedTxids = await transmitSpell(context, signedSpell);
		return transmittedTxids;
	}

	return ['', ''];
}

if (require.main === module) {
	mintCli(process.argv.slice(2)).catch(err => {
		logger.error(err);
	});
}
