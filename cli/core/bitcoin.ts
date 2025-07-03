import Client from 'bitcoin-core';
import { Utxo } from './types';

class ExtendedClient extends Client {

    walletName: string;

    constructor(options: any) {
        super(options);
        this.walletName = process.env.BTC_WALLET_NAME || 'default';
    }

    sendRawTransaction(txHex: string): Promise<string> {
        return this.command('sendrawtransaction', txHex);
    }
    signTransactionInputs(txHex: string, prevtxs?: string[], sighashType?: string): Promise<any> {
        return this.command('signrawtransactionwithwallet', txHex, prevtxs, sighashType);
    }
    listUnspent(minconf: number, maxconf: number, addresses: string[]): Promise<any[]> {
        return this.command('listunspent', minconf, maxconf, addresses);
    }
    getNewAddress(): Promise<string> {
        return this.command('getnewaddress');
    }
    loadWallet(): Promise<any> {
        return this.command('loadwallet', this.walletName);
    }
}

export class BitcoinClient {

    private client: ExtendedClient | null = null;

    private constructor() {
        // Private constructor
    }

    public static async create() {
        const instance = new BitcoinClient();
        instance.client = new ExtendedClient({
            username: process.env.BTC_NODE_USERNAME || 'bitcoin',
            password: process.env.BTC_NODE_PASSWORD || '1234',
            host: process.env.BTC_NODE_HOST || 'http://localhost:18443', // default for regtest
            timeout: 30000 // 30 seconds
        });
        try {
            await instance.client.loadWallet();
        } catch (error: any) {
            if (!error.message.includes('is already loaded')) {
                throw new Error(`Failed to load wallet: ${error.message}`);
            }
        }
        return instance;
    }

    public async getTransaction(txid: string): Promise<string> {
        return await this.client!.getTransactionByHash(txid, { extension: 'hex' });
    }

    public async signTransaction(txHex: string, prevtxs?: string[], sighashType?: string): Promise<string> {
        const result = await this.client!.signTransactionInputs(txHex, prevtxs, sighashType);
        if (!result.complete) throw new Error('Transaction signing failed');
        return result.hex;
    }

    public async transmitTransaction(txHex: string): Promise<string> {
        return this.client!.sendRawTransaction(txHex);
    }

    public async listUnspent(address?: string): Promise<{ spendable: boolean, value: number, txid: string, vout: number }[]> {
        return this.client!.listUnspent(1, 9999999, address ? [address] : [])
            .then(utxos => utxos.map(utxo => ({
                spendable: utxo.spendable,
                value: Math.floor(utxo.amount * 1e8), // Convert BTC to satoshis
                txid: utxo.txid,
                vout: utxo.vout
            })));
    }

    public async getAddress(): Promise<string> {
        return this.client!.getNewAddress();
    }

    public async getFundingUtxo(): Promise<Utxo> {
        const unspent = (await this.listUnspent()).filter(utxo => utxo.spendable && utxo.value >= 1000);
        if (unspent.length === 0) {
            throw new Error('No suitable funding UTXO found');
        }
        return unspent[0];
    }
}
