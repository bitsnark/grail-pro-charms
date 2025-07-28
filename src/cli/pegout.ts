import minimist from 'minimist';
import dotenv from 'dotenv';
import { BitcoinClient } from '../core/bitcoin';
import { Network } from '../core/taproot/taproot-common';
import { setupLog } from '../core/log';
import { bufferReplacer } from '../core/json';
import { Context } from '../core/context';
import { parse } from '../core/env-parser';
import {
	SignatureRequest,
	SignatureResponse,
	UserPaymentDetails,
} from '../core/types';
import {
	findUserPaymentVout,
	getPreviousGrailState,
	getPreviousTransactions,
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
} from '../api/spell-operations';
import {
	generateSpendingScriptForGrail,
	generateSpendingScriptsForUserPayment,
} from '../core/taproot';
import { privateToKeypair } from './generate-random-keypairs';
import { createPegoutSpell } from '../api/create-pegout-spell';

async function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: {},
		string: ['new-public-keys', 'private-keys'],
		boolean: ['transmit', 'mock-proof'],
		default: {
			network: 'regtest',
			feerate: 0.00002,
			transmit: true,
			'mock-proof': false,
		},
		'--': true,
	});

	const bitcoinClient = await BitcoinClient.initialize();
	const fundingUtxo = await bitcoinClient.getFundingUtxo();

	const appId = argv['app-id'] as string;
	if (!appId) {
		console.error('--app-id is required');
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

	if (!argv['user-payment-txid']) {
		console.error('--user-payment-txid is required');
		return;
	}
	if (!argv['recovery-public-key']) {
		console.error('--recovery-public-key is required');
		return;
	}
	const recoveryPublicKey = (argv['recovery-public-key'] as string).replace(
		'0x',
		''
	);

	const newGrailState = {
		publicKeys: newPublicKeys,
		threshold: newThreshold,
	};

	const userWalletAddress =
		await context.bitcoinClient.getUserWalletAddressFromFundingUtxo(
			fundingUtxo,
			argv['network'] as Network
		);

	const userPaymentDetails: UserPaymentDetails = {
		txid: argv['user-payment-txid'] as string,
		vout: Number.parseInt(argv['user-payment-vout'] as string) || 0,
		recoveryPublicKey,
		timelockBlocks: 100,
		grailState: newGrailState,
		userWalletAddress,
	};

	let userPaymentVout = 0;
	if (!argv['user-payment-vout']) {
		console.warn('--user-payment-vout not provided, auto detecting...');
		userPaymentVout = await findUserPaymentVout(
			context,
			newGrailState,
			userPaymentDetails
		);
		userPaymentDetails.vout = userPaymentVout;
		console.warn(`Detected user payment vout: ${userPaymentVout}`);
	}

	if (!argv['feerate']) {
		console.error('--feerate is required');
		return;
	}
	const feerate = Number.parseFloat(argv['feerate']);

	const { spell, signatureRequest } = await createPegoutSpell(
		context,
		feerate,
		previousNftTxid,
		newGrailState,
		userPaymentDetails,
		userWalletAddress,
		fundingUtxo
	);
	console.log('Spell created:', JSON.stringify(spell, bufferReplacer, '\t'));

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
	console.log(
		'Signed spell:',
		JSON.stringify(signedSpell, bufferReplacer, '\t')
	);

	if (transmit) {
		await transmitSpell(context, signedSpell);
	}
}

if (require.main === module) {
	main().catch(err => {
		console.error(err);
	});
}
