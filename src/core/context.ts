import { logger } from './logger';
import { getVerificationKey } from './charms-sdk';
import { IContext } from './i-context';
import { Network } from './taproot/taproot-common';
import { randomBytes } from 'node:crypto';
import { Utxo } from './types';
import { sha256 } from 'bitcoinjs-lib/src/crypto';
import { BitcoinClient } from './bitcoin';

export class Context implements IContext {
	charmsBin!: string;
	zkAppBin!: string;

	appId!: string;
	appVk!: string;

	ticker!: string;

	network!: Network;
	mockProof!: boolean;
	skipProof!: boolean;
	temporarySecret!: Buffer<ArrayBufferLike>;

	bitcoinClient!: BitcoinClient;

	private constructor() {}

	public static async create(obj: Partial<IContext>): Promise<Context> {
		const thus = new Context();

		// assertFileExists('charmsBin', obj.charmsBin);
		thus.charmsBin = obj.charmsBin!;

		// assertFileExists('zkAppBin', obj.zkAppBin);
		thus.zkAppBin = obj.zkAppBin!;

		if (!obj.appId) throw new Error('App ID is required');
		thus.appId = obj.appId;
		logger.info('App ID: ', thus.appId);

		thus.network = obj.network || 'regtest';
		thus.mockProof = obj.mockProof || false;
		thus.skipProof = obj.skipProof || false;

		const charmsSecret = process.env.CHARMS_SECRET
			? Buffer.from(process.env.CHARMS_SECRET, 'hex')
			: randomBytes(32);
		thus.temporarySecret = charmsSecret;

		if (!obj.appVk) {
			logger.warn(
				'App VK is not provided, using charms app vk command to retrieve it'
			);
			thus.appVk = await getVerificationKey(thus);
		} else {
			thus.appVk = obj.appVk;
		}
		logger.info('App Verification Key: ', thus.appVk);

		if (!obj.ticker) throw new Error('Ticker is required');
		thus.ticker = obj.ticker;

		thus.bitcoinClient = await BitcoinClient.initialize(obj.core);

		return thus;
	}

	public static async createForDeploy(
		obj: Partial<Exclude<IContext, ['appId']>>,
		fundingUtxo: Utxo
	) {
		const appId = sha256(
			Buffer.from(`${fundingUtxo.txid}:${fundingUtxo.vout}`, 'ascii')
		).toString('hex');
		return Context.create({ ...obj, appId });
	}
}
