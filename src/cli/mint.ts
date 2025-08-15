import { logger } from '../core/logger';
import minimist from 'minimist';
import dotenv from 'dotenv';
import { SignatureResponse, TokenDetails } from '../core/types';
import {
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
} from '../api/spell-operations';
import { privateToKeypair } from './generate-random-keypairs';
import { DEFAULT_FEERATE } from './consts';
import { filterValidCosignerSignatures } from '../api/spell-operations';
import { createMintSpell } from '../api/create-mint-spell';
import { createContext } from './utils';
import { getFundingUtxo } from '../api/spell-operations';

export const TIMELOCK_BLOCKS = 100; // Default timelock for user payments

export async function mintCli(_argv: string[]): Promise<[string, string]> {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });

	const argv = minimist(_argv, {
		alias: {},
		string: ['private-keys', 'user-wallet-address'],
		boolean: ['transmit', 'mock-proof', 'skip-proof'],
		default: {
			'user-payment-vout': 0,
		},
		'--': true,
	});

	const appId = argv['app-id'] as string;
	if (!appId) {
		throw new Error('--app-id is required');
	}

	const context = await createContext(argv);

	const feerate = Number.parseFloat(argv['feerate']) || DEFAULT_FEERATE;
	const transmit = argv['transmit'] as boolean;
	const fundingUtxo = await getFundingUtxo(context, feerate);

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

	const userWalletAddress =
		(argv['user-wallet-address'] as string) ||
		(await context.bitcoinClient.getAddress());

	const amount = Number.parseInt(argv['amount'] as string, 10);
	if (!amount || isNaN(amount) || amount <= 0) {
		throw new Error('--amount is required and must be a valid number');
	}

	const tokenDetails: TokenDetails = {
		ticker: argv['ticker'] as string,
		name: argv['token-name'] as string,
		image: argv['token-image'] as string,
		url: argv['token-url'] as string,
	};

	const { spell, signatureRequest } = await createMintSpell(
		context,
		tokenDetails,
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
