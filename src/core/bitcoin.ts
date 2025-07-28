import Client from 'bitcoin-core';
import { Utxo } from './types';

export class ExtendedClient {
	client!: Client;
	constructor(client: Client) {
		this.client = client
	}

	getRawTransaction(txid: string): Promise<any> {
		return this.client.command('getrawtransaction', txid, true);
	}
	sendRawTransaction(txHex: string): Promise<string> {
		return this.client.command('sendrawtransaction', txHex);
	}
	signTransactionInputs(
		txHex: string,
		prevtxs?: string[],
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
}

export class BitcoinClient {
	private client: ExtendedClient | null = null;

	private constructor() { }

	public static async initialize(
		client?: Client
	): Promise<BitcoinClient> {
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
				}));
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
		const tx = (await this.client!.getRawTransaction(txid)) as { hex: string };
		return tx.hex;
	}

	public async signTransaction(
		txHex: string,
		prevtxs?: string[],
		sighashType?: string
	): Promise<string> {
		const result = await this.client!.signTransactionInputs(
			txHex,
			prevtxs,
			sighashType
		);
		if (!result.complete) throw new Error('Transaction signing failed');
		return result.hex;
	}

	public async transmitTransaction(txHex: string): Promise<string> {
		return this.client!.sendRawTransaction(txHex);
	}

	public async listUnspent(
		address?: string
	): Promise<
		{ spendable: boolean; value: number; txid: string; vout: number }[]
	> {
		return this.client!.listUnspent(1, 9999999, address ? [address] : []).then(
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
			utxo => utxo.spendable && utxo.value >= 10000
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
}
