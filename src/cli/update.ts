import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { createUpdateNftSpell } from '../api/create-update-nft-spell';
import { privateToKeypair } from './generate-random-keypairs';
import {
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
} from '../api/spell-operations';
import { bufferReplacer } from '../core/json';
import { getNewGrailStateFromArgv } from './utils';
import { SignatureResponse } from '../core/types';
import { DEFAULT_FEERATE } from './consts';

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(process.argv.slice(2), {
		alias: {},
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
		logger.error('--app-id is required');
		return;
	}
	const appVk = argv['app-vk'] as string;

	const context = await Context.create({
		appId,
		appVk,
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network: argv['network'] as Network,
		mockProof: argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	const previousNftTxid = argv['previous-nft-txid'] as string;
	if (!previousNftTxid) {
		logger.error('--previous-nft-txid is required');
		return;
	}

	const transmit = !!argv['transmit'];

	if (!argv['private-keys']) {
		logger.error('--private-keys is required');
		return;
	}
	const privateKeys = (argv['private-keys'] as string)
		.split(',')
		.map(s => s.trim().replace('0x', ''));

	if (!argv['feerate']) {
		logger.error('--feerate is required: ', argv);
		return;
	}
	const feerate = Number.parseFloat(argv['feerate']);

	const newGrailState = getNewGrailStateFromArgv(argv);
	if (!newGrailState) {
		logger.error('Invalid new grail state');
		return;
	}

	const { spell, signatureRequest } = await createUpdateNftSpell(
		context,
		feerate,
		previousNftTxid,
		newGrailState,
		fundingUtxo
	);
	logger.debug('Spell created:', spell);
	logger.debug('Signature request:', signatureRequest);

	const fromCosigners: SignatureResponse[] = privateKeys
		.map(pk => Buffer.from(pk, 'hex'))
		.map(privateKey => {
			const keypair = privateToKeypair(privateKey);
			const signatures = signAsCosigner(context, signatureRequest, keypair);
			return { publicKey: keypair.publicKey.toString('hex'), signatures };
		});

	const signedSpell = await injectSignaturesIntoSpell(
		context,
		spell,
		signatureRequest,
		fromCosigners
	);
	logger.debug('Signed spell:', signedSpell);

	if (transmit) {
		await transmitSpell(context, signedSpell);
	}
}

if (require.main === module) {
	main().catch(error => {
		logger.error('Error during NFT update:', error);
	});
}
