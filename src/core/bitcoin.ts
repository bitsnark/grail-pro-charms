import { logger } from './logger';
import Client from 'bitcoin-core';
import { PreviousTransactions, Utxo } from './types';
import * as bitcoin from 'bitcoinjs-lib';

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

export class ExtendedClient {
	client!: Client;
	constructor(client: Client) {
		this.client = client;
	}

	getRawTransaction(txid: string): Promise<any> {
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
	): Promise<any> {
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
	): Promise<any[]> {
		return this.client.command('listunspent', minconf, maxconf, addresses);
	}
	getNewAddress(): Promise<string> {
		return this.client.command('getnewaddress');
	}
	loadWallet(name: string): Promise<any> {
		return this.client.command('loadwallet', name);
	}
	sendToAddress(toAddress: string, amountBtc: number): Promise<string> {
		return this.client.command('sendtoaddress', toAddress, amountBtc);
	}
	getTxOut(
		txid: string,
		vout: number,
		includeMempool: boolean = true
	): Promise<any> {
		return this.client.command('gettxout', txid, vout, includeMempool);
	}
	generateToAddress(blocks: number, address: string): Promise<string[]> {
		return this.client.command('generatetoaddress', blocks, address);
	}
	generateBlocks(address: string, txids: string[]): Promise<void> {
		return this.client.command('generateblock', address, txids);
	}
}

export class BitcoinClient {
	private client: ExtendedClient | null = null;
	private static txhash: { [txid: string]: Buffer } = {};

	private constructor() {}

	public static async initialize(client?: Client): Promise<BitcoinClient> {
		const thus = new BitcoinClient();
		if (client) {
			thus.client = new ExtendedClient(client);
		} else {
			thus.client = new ExtendedClient(
				new Client({
					username: process.env.BTC_NODE_USERNAME || 'bitcoin',
					password: process.env.BTC_NODE_PASSWORD || '1234',
					host: process.env.BTC_NODE_HOST || 'http://localhost:18443', // default for regtest
					timeout: 30000, // 30 seconds
				})
			);
			const walletName = process.env.BTC_WALLET_NAME || 'default';
			try {
				await thus.client.loadWallet(walletName);
			} catch (error: any) {
				if (!error.message.includes('is already loaded')) {
					throw new Error(`Failed to load wallet: ${error.message}`);
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
			? tx.ins.map((input, index) => {
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
			utxos =>
				utxos.map(utxo => ({
					spendable: utxo.spendable,
					value: Math.floor(utxo.amount * 1e8), // Convert BTC to satoshis
					txid: utxo.txid,
					vout: utxo.vout,
				}))
		);
	}

	public async getAddress(): Promise<string> {
		return this.client!.getNewAddress();
	}

	public async getFundingUtxo(): Promise<Utxo> {
		const unspent = (await this.listUnspent()).filter(
			utxo => utxo.spendable && utxo.value >= 1000000 // 0.01 BTC minimum
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
}
