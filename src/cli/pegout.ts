import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { SignatureResponse, UserPaymentDetails } from '../core/types';
import {
	filterValidCosignerSignatures,
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
import { createContext, getFundingUtxo } from './utils';

export async function pegoutCli(_argv: string[]): Promise<[string, string]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		string: ['new-public-keys', 'private-keys'],
		boolean: ['transmit', 'mock-proof', 'skip-proof'],
		default: {
			network: 'regtest',
			feerate: DEFAULT_FEERATE,
			transmit: true,
			'mock-proof': false,
			'skip-proof': false,
		},
		'--': true,
	});

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}
	const appVk = argv['app-vk'] as string;
	if (appVk === undefined) {
		throw new Error('--app-vk is required');
	}

	const context = await createContext(argv);

	const feerate = Number.parseFloat(argv['feerate']) || DEFAULT_FEERATE;
	const transmit = argv['transmit'] as boolean;
	const fundingUtxo = await getFundingUtxo(context, feerate);

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
		context.network
	);

	const userPaymentDetails: UserPaymentDetails = {
		txid: userPaymentTxid,
		vout: userPaymentVout,
		recoveryPublicKey,
		timelockBlocks: TIMELOCK_BLOCKS,
		grailState: newGrailState,
		userWalletAddress,
	};

	const { spell, signatureRequest } = await createPegoutSpell(
		context,
		feerate,
		previousNftTxid,
		newGrailState,
		userPaymentDetails,
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
		return await transmitSpell(context, signedSpell);
	}
	return ['', ''];
}

if (require.main === module) {
	pegoutCli(process.argv.slice(2)).catch(err => {
		logger.error(err);
	});
}
