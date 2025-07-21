import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { setupLog } from '../core/log';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import { createUpdateNftSpell } from '../api/create-update-nft-spell';
import { KeyPair } from '../core/taproot';
import { publicFromPrivate } from './generate-random-keypairs';
import {
	injectSignaturesIntoSpell,
	signSpell,
	transmitSpell,
} from '../api/spell-operations';

function prepareKeypairs(privateKeys: string[]): KeyPair[] {
	return privateKeys.map(priv => ({
		publicKey: publicFromPrivate(
			Buffer.from(priv.trim().replace('0x', ''), 'hex')
		),
		privateKey: Buffer.from(priv.trim().replace('0x', ''), 'hex'),
	}));
}

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		default: {
			alias: {},
			string: ['new-public-keys', 'private-keys'],
			boolean: ['transmit', 'mock-proof'],
			default: {
				network: 'regtest',
				feerate: 0.002,
				transmit: true,
				'mock-proof': false,
			},
		},
		'--': true,
	});

	const bitcoinClient = await BitcoinClient.create();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const context = await Context.create({
		charmsBin: parse.string('CHARMS_BIN'),
		zkAppBin: './zkapp/target/charms-app',
		network: argv['network'] as Network,
		mockProof: argv['mock-proof'],
		ticker: 'GRAIL-NFT',
	});

	if (!argv['new-public-keys']) {
		console.error('--new-public-keys is required');
		return;
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
		console.error(
			'Invalid new threshold. It must be a number between 1 and the number of public keys.'
		);
		return;
	}

	const previousNftTxid = argv['previous-nft-txid'] as string;
	if (!previousNftTxid) {
		console.error('--previous-nft-txid is required');
		return;
	}

	const transmit = !!argv['transmit'];

	if (!argv['private-keys']) {
		console.error('--private-keys is required');
		return;
	}
	const privateKeys = (argv['private-keys'] as string)
		.split(',')
		.map(s => s.trim().replace('0x', ''));

	const spell = await createUpdateNftSpell(
		context,
		Number(argv['feerate']),
		previousNftTxid,
		{
			publicKeys: newPublicKeys,
			threshold: newThreshold,
		},
		fundingUtxo
	);
	console.log('Spell created:', JSON.stringify(spell, null, '\t'));

	const signaturePackage = await signSpell(
		context,
		spell,
		previousNftTxid,
		{
			publicKeys: newPublicKeys,
			threshold: newThreshold,
		},
		null,
		prepareKeypairs(privateKeys)
	);

	const signedSpell = await injectSignaturesIntoSpell(
		context,
		spell,
		previousNftTxid,
		signaturePackage
	);
	console.log('Signed spell:', JSON.stringify(signedSpell, null, '\t'));

	if (transmit) {
		await transmitSpell(context, signedSpell);
	}
}

if (require.main === module) {
	main().catch(error => {
		console.error('Error during NFT update:', error);
	});
}
