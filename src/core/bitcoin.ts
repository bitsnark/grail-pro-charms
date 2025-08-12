import Client from 'bitcoin-core';
import { Outspend, PreviousTransactions, Utxo } from './types';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { bitcoinjslibNetworks, Network } from './taproot/taproot-common';
import { logger } from './logger';
import { parse } from './env-parser';

bitcoin.initEccLib(ecc);

export const DUST_LIMIT = 546;

export function txidToHash(txid: string): Buffer {
	return Buffer.from(txid, 'hex').reverse();
}

export function hashToTxid(hash: Buffer): string {
	// This is a hack to avoid Buffer.reverse() which behaves unexpectedly
	return Buffer.from(Array.from(hash).reverse()).toString('hex');
}

export function txBytesToTxid(txBytes: Buffer): string {
	return bitcoin.Transaction.fromBuffer(txBytes).getId();
}

export function txHexToTxid(txHex: string): string {
	const txBytes = Buffer.from(txHex, 'hex');
	return txBytesToTxid(txBytes);
}

export function getAddressFromScript(script: Buffer, network: Network): string {
	const address = [
		bitcoin.payments.p2ms,
		bitcoin.payments.p2pk,
		bitcoin.payments.p2pkh,
		bitcoin.payments.p2sh,
		bitcoin.payments.p2wpkh,
		bitcoin.payments.p2wsh,
		bitcoin.payments.p2tr,
	]
		.map(payment => {
			try {
				return payment({
					output: script,
					network: bitcoinjslibNetworks[network],
				}).address;
			} catch (error) {
				logger.devnull(error);
				return undefined;
			}
		})
		.filter(Boolean)[0];
	if (!address) {
		return script.toString('hex'); // Fallback to hex representation if no address found
	}
	return address;
}

export class ExtendedClient {
	client!: Client;
	constructor(client: Client) {
		this.client = client;
	}

	getRawTransaction(txid: string): Promise<{ hex: string } | undefined> {
		return this.client.command('getrawtransaction', txid, true);
	}
	sendRawTransaction(txHex: string): Promise<string> {
		return this.client.command('sendrawtransaction', txHex);
	}
	signTransactionInputs(
		txHex: string,
		prevtxs?: {
			txid: string;
			vout: number;
			scriptPubKey: string;
			redeemScript: string;
			witnessScript: string;
			amount: number;
		}[],
		sighashType?: string
	): Promise<{ complete: boolean; hex: string }> {
		return this.client.command(
			'signrawtransactionwithwallet',
			txHex,
			prevtxs,
			sighashType
		);
	}
	listUnspent(
		minconf: number,
		maxconf: number,
		addresses: string[]
	): Promise<
		{ spendable: boolean; amount: number; txid: string; vout: number }[]
	> {
		return this.client.command('listunspent', minconf, maxconf, addresses);
	}
	getNewAddress(): Promise<string> {
		return this.client.command('getnewaddress');
	}
	loadWallet(name: string): Promise<boolean> {
		return this.client.command('loadwallet', name);
	}
	unloadWallet(name: string): Promise<void> {
		return this.client.command('unloadwallet', name);
	}
	sendToAddress(toAddress: string, amountBtc: number): Promise<string> {
		return this.client.command('sendtoaddress', toAddress, amountBtc);
	}
	getTxOut(
		txid: string,
		vout: number,
		includeMempool: boolean = true
	): Promise<Utxo | undefined> {
		return this.client.command('gettxout', txid, vout, includeMempool);
	}
	generateToAddress(blocks: number, address: string): Promise<string[]> {
		return this.client.command('generatetoaddress', blocks, address);
	}
	generateBlocks(address: string, txids: string[]): Promise<void> {
		return this.client.command('generateblock', address, txids);
	}
}

export interface ExtendedTxInput {
	prevout: {
		hash: string;
		index: number;
	};
	script: string;
	witness: string;
	sequence: number;
	address: string | null;
}

export interface ExtendedTxOutput {
	value: number; // in satoshis
	script: string;
	address: string | null;
}

export interface ExtendedTransaction {
	txid: string;
	version: number;
	locktime: number;
	vin: ExtendedTxInput[];
	vout: ExtendedTxOutput[];
	size: number;
	weight?: number;
	fee?: number; // in satoshis
	status: {
		confirmed: boolean;
		block_height?: number;
		block_hash?: string;
		block_time?: number; // Unix timestamp
	};
	hex?: string;
}

export class BitcoinClient {
	private client: ExtendedClient | null = null;
	private mempoolUrl: string;
	private static txhash: { [txid: string]: Buffer } = {};

	private constructor() {
		this.mempoolUrl = parse.string('MEMPOOL_URL', 'https://mempool.space/api');
	}

	public static async initialize(client?: Client): Promise<BitcoinClient> {
		const thus = new BitcoinClient();
		if (client) {
			thus.client = new ExtendedClient(client);
		} else {
			thus.client = new ExtendedClient(
				new Client({
					username: parse.string('BTC_NODE_USERNAME', 'bitcoin'),
					password: parse.string('BTC_NODE_PASSWORD', '1234'),
					host: parse.string('BTC_NODE_HOST', 'http://localhost:18443'),
					timeout: 30000, // 30 seconds
				})
			);
			const walletName = parse.string('BTC_WALLET_NAME', 'default');
			try {
				await thus.client.loadWallet(walletName);
			} catch (error) {
				const message = (error as { message: string }).message ?? '';
				// Check for various wallet already loaded error messages
				if (
					!message.includes('is already loaded') &&
					!message.includes('Database is already opened') &&
					!message.includes('Unable to obtain an exclusive lock')
				) {
					logger.error(error);
					throw new Error(`Failed to load wallet: ${message}`);
				}
				// If it's a lock error, try to unload and reload
				if (message.includes('Unable to obtain an exclusive lock')) {
					try {
						await thus.client.unloadWallet(walletName);
						await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
						await thus.client.loadWallet(walletName);
					} catch (error) {
						const message = (error as { message: string }).message ?? '';
						throw new Error(
							`Failed to reload wallet after lock error: ${message}`
						);
					}
				}
			}
		}
		return thus;
	}

	public async getTransactionHex(txid: string): Promise<string> {
		if (BitcoinClient.txhash[txid]) {
			return BitcoinClient.txhash[txid].toString('hex');
		}
		const tx = (await this.client!.getRawTransaction(txid)) as { hex: string };
		BitcoinClient.txhash[txid] = Buffer.from(tx.hex, 'hex');
		return tx.hex;
	}

	public async getTransactionBytes(txid: string): Promise<Buffer> {
		if (BitcoinClient.txhash[txid]) {
			return BitcoinClient.txhash[txid];
		}
		const txHex = await this.getTransactionHex(txid);
		return Buffer.from(txHex, 'hex');
	}

	public async signTransaction(
		txBytes: Buffer,
		prevtxsBytesMap?: PreviousTransactions,
		sighashType?: string
	): Promise<Buffer> {
		const tx = bitcoin.Transaction.fromBuffer(txBytes);
		const prevtxinfo = prevtxsBytesMap
			? tx.ins.map(input => {
					const prevtxid = hashToTxid(input.hash);
					const prevtxbytes = prevtxsBytesMap[prevtxid];
					if (!prevtxbytes) {
						throw new Error(`Previous transaction ${prevtxid} not found`);
					}
					const prevtxObj = bitcoin.Transaction.fromBuffer(prevtxbytes);
					const output = prevtxObj.outs[input.index];
					return {
						txid: prevtxid,
						vout: input.index,
						scriptPubKey: output.script.toString('hex'),
						redeemScript: '',
						witnessScript: '',
						amount: output.value / 100000000, // Convert satoshis to BTC
					};
				})
			: undefined;

		const result = await this.client!.signTransactionInputs(
			txBytes.toString('hex'),
			prevtxinfo,
			sighashType
		);
		if (!result.complete) throw new Error('Transaction signing failed');
		return Buffer.from(result.hex, 'hex');
	}

	public async transmitTransaction(txBytes: Buffer): Promise<string> {
		return this.client!.sendRawTransaction(txBytes.toString('hex'));
	}

	public async listUnspent(
		address?: string
	): Promise<
		{ spendable: boolean; value: number; txid: string; vout: number }[]
	> {
		return this.client!.listUnspent(0, 9999999, address ? [address] : []).then(
			unspent =>
				unspent.map(us => ({
					spendable: us.spendable,
					value: Math.floor(us.amount * 1e8), // Convert BTC to satoshis
					txid: us.txid,
					vout: us.vout,
				}))
		);
	}

	public async getAddress(): Promise<string> {
		return this.client!.getNewAddress();
	}

	public async getFundingUtxo(): Promise<Utxo> {
		const unspent = (await this.listUnspent()).filter(
			utxo => utxo.spendable && utxo.value >= 10000 // 0.001 BTC minimum
		);
		if (unspent.length === 0) {
			throw new Error('No suitable funding UTXO found');
		}
		return unspent[0];
	}

	public async fundAddress(address: string, amount: number): Promise<string> {
		const txId: string = await this.client!.sendToAddress(
			address,
			amount / 1e8
		); // Convert satoshis to BTC
		return txId;
	}

	public async getTransactionsBytes(txids: string[]): Promise<Buffer[]> {
		const transactions = [];
		for (const txid of txids) {
			const tx = await this.getTransactionBytes(txid);
			transactions.push(tx);
		}
		return transactions;
	}

	public async getTransactionsMap(
		txids: string[]
	): Promise<{ [txid: string]: Buffer }> {
		const transactions = await this.getTransactionsBytes(txids);
		return transactions.reduce(
			(acc, txBytes) => {
				acc[txBytesToTxid(txBytes)] = txBytes;
				return acc;
			},
			{} as { [key: string]: Buffer }
		);
	}

	public async isUtxoSpendable(txid: string, vout: number): Promise<boolean> {
		return !!(await this.client!.getTxOut(txid, vout, true));
	}

	public async generateBlocks(txids: string[]): Promise<void> {
		const output = await this.getAddress();
		await this.client!.generateBlocks(output, txids);
	}

	public async generateToAddress(
		blocks: number,
		address: string
	): Promise<string[]> {
		return this.client!.generateToAddress(blocks, address);
	}

	async getOutspends(txid: string): Promise<Outspend[]> {
		const response = await fetch(`${this.mempoolUrl}/tx/${txid}/outspends`);
		if (!response.ok) {
			throw new Error(`Failed to fetch outspends: ${response.statusText}`);
		}
		return response.json();
	}

	async getExtendedTransactionData(txid: string): Promise<ExtendedTransaction> {
		const response = await fetch(`${this.mempoolUrl}/tx/${txid}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch transaction: ${response.statusText}`);
		}
		return response.json();
	}
}
