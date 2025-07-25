"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinClient = exports.ExtendedClient = void 0;
const bitcoin_core_1 = __importDefault(require("bitcoin-core"));
class ExtendedClient extends bitcoin_core_1.default {
    constructor(options) {
        super(options);
    }
    getRawTransaction(txid) {
        return this.command('getrawtransaction', txid, true);
    }
    sendRawTransaction(txHex) {
        return this.command('sendrawtransaction', txHex);
    }
    signTransactionInputs(txHex, prevtxs, sighashType) {
        return this.command('signrawtransactionwithwallet', txHex, prevtxs, sighashType);
    }
    listUnspent(minconf, maxconf, addresses) {
        return this.command('listunspent', minconf, maxconf, addresses);
    }
    getNewAddress() {
        return this.command('getnewaddress');
    }
    loadWallet(name) {
        return this.command('loadwallet', name);
    }
    sendToAddress(toAddress, amountBtc) {
        return this.command('sendtoaddress', toAddress, amountBtc);
    }
}
exports.ExtendedClient = ExtendedClient;
class BitcoinClient {
    constructor() {
        this.client = null;
    }
    static async initialize(client) {
        const thus = new BitcoinClient();
        if (client) {
            thus.client = client;
        }
        else {
            thus.client = new ExtendedClient({
                username: process.env.BTC_NODE_USERNAME || 'bitcoin',
                password: process.env.BTC_NODE_PASSWORD || '1234',
                host: process.env.BTC_NODE_HOST || 'http://localhost:18443', // default for regtest
                timeout: 30000, // 30 seconds
            });
            const walletName = process.env.BTC_WALLET_NAME || 'default';
            try {
                await thus.client.loadWallet(walletName);
            }
            catch (error) {
                if (!error.message.includes('is already loaded')) {
                    throw new Error(`Failed to load wallet: ${error.message}`);
                }
            }
        }
        return thus;
    }
    async getTransactionHex(txid) {
        const tx = (await this.client.getRawTransaction(txid));
        return tx.hex;
    }
    async signTransaction(txHex, prevtxs, sighashType) {
        const result = await this.client.signTransactionInputs(txHex, prevtxs, sighashType);
        if (!result.complete)
            throw new Error('Transaction signing failed');
        return result.hex;
    }
    async transmitTransaction(txHex) {
        return this.client.sendRawTransaction(txHex);
    }
    async listUnspent(address) {
        return this.client.listUnspent(1, 9999999, address ? [address] : []).then(utxos => utxos.map(utxo => ({
            spendable: utxo.spendable,
            value: Math.floor(utxo.amount * 1e8), // Convert BTC to satoshis
            txid: utxo.txid,
            vout: utxo.vout,
        })));
    }
    async getAddress() {
        return this.client.getNewAddress();
    }
    async getFundingUtxo() {
        const unspent = (await this.listUnspent()).filter(utxo => utxo.spendable && utxo.value >= 10000);
        if (unspent.length === 0) {
            throw new Error('No suitable funding UTXO found');
        }
        return unspent[0];
    }
    async fundAddress(address, amount) {
        const txId = await this.client.sendToAddress(address, amount / 1e8); // Convert satoshis to BTC
        return txId;
    }
}
exports.BitcoinClient = BitcoinClient;
