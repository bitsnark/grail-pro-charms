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

export async function updateNftCli(
	_argv: string[]
): Promise<{ spellTxid: string }> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
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
		throw new Error('--app-id is required');
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
		throw new Error('--previous-nft-txid is required');
	}

	const transmit = !!argv['transmit'];

	if (!argv['private-keys']) {
		throw new Error('--private-keys is required');
	}
	const privateKeys = (argv['private-keys'] as string)
		.split(',')
		.map(s => s.trim().replace('0x', ''));

	if (!argv['feerate']) {
		throw new Error('--feerate is required');
	}
	const feerate = Number.parseFloat(argv['feerate']);

	const newGrailState = getNewGrailStateFromArgv(argv);
	if (!newGrailState) {
		throw new Error('Invalid new grail state');
	}

	const { spell, signatureRequest } = await createUpdateNftSpell(
		context,
		feerate,
		previousNftTxid,
		newGrailState,
		fundingUtxo
	);
	logger.debug('Spell created: ', spell);
	logger.debug('Signature request: ', signatureRequest);

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
	logger.debug('Signed spell: ', signedSpell);

	if (transmit) {
		const [_, spellTxid] = await transmitSpell(context, signedSpell);
		return { spellTxid };
	}
	return { spellTxid: '' };
}

async function main() {
	try {
		const result = await updateNftCli(process.argv.slice(2));
		console.log('NFT update completed successfully:', result);
		process.exit(0);
	} catch (error) {
		console.error('Error during NFT update:', error);
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch(error => {
		logger.error('Error during NFT update: ', error);
	});
}
