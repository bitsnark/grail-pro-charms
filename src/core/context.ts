import fs from 'node:fs';
import { getVerificationKey } from './charms-sdk';
import { IContext } from './i-context';
import { Network } from './taproot/taproot-common';
import { randomBytes } from 'node:crypto';
import { BitcoinClient } from './bitcoin';
import { Utxo } from './types';
import { sha256 } from 'bitcoinjs-lib/src/crypto';

function assertFileExists(desc: string, path?: string): void {
	if (!fs.existsSync(path || '')) {
		throw new Error(`File not found, desc: ${desc}, path: ${path}`);
	}
}

export class Context implements IContext {
	charmsBin!: string;
	zkAppBin!: string;

	appId!: string;
	appVk!: string;

	ticker!: string;

	network!: Network;
	mockProof!: boolean;
	temporarySecret: Buffer<ArrayBufferLike> = randomBytes(32);

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
		console.log('App ID:', thus.appId);

		thus.network = obj.network || 'regtest';
		thus.mockProof = obj.mockProof || false;

		if (!obj.appVk) {
			console.warn(
				'App VK is not provided, using charms app vk command to retrieve it'
			);
			thus.appVk = await getVerificationKey(thus);
		} else {
			thus.appVk = obj.appVk;
		}
		console.log('App Verification Key:', thus.appVk);

		if (!obj.ticker) throw new Error('Ticker is required');
		thus.ticker = obj.ticker;

		if (obj.bitcoinClient) {
			thus.bitcoinClient = obj.bitcoinClient;
		} else {
			thus.bitcoinClient = await BitcoinClient.initialize();
		}

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
