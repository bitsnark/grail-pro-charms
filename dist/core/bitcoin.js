"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinClient = void 0;
const bitcoin_core_1 = __importDefault(require("bitcoin-core"));
class ExtendedClient extends bitcoin_core_1.default {
    constructor(options) {
        super(options);
        this.walletName = process.env.BTC_WALLET_NAME || 'default';
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
    loadWallet() {
        return this.command('loadwallet', this.walletName);
    }
    sendToAddress(toAddress, amountBtc) {
        return this.command('sendtoaddress', toAddress, amountBtc);
    }
}
let ___instance = null;
let ___promise = null;
class BitcoinClient {
    constructor() {
        this.client = null;
        // Private constructor
    }
    static async create() {
        if (___instance != null && ___promise == null) {
            return ___instance;
        }
        if (___promise != null) {
            return ___promise;
        }
        ___instance = new BitcoinClient();
        ___promise = ___instance.initialize().then(instance => {
            ___promise = null;
            return instance;
        });
        return ___promise;
    }
    async initialize() {
        this.client = new ExtendedClient({
            username: process.env.BTC_NODE_USERNAME || 'bitcoin',
            password: process.env.BTC_NODE_PASSWORD || '1234',
            host: process.env.BTC_NODE_HOST || 'http://localhost:18443', // default for regtest
            timeout: 30000, // 30 seconds
        });
        try {
            await this.client.loadWallet();
        }
        catch (error) {
            if (!error.message.includes('is already loaded')) {
                throw new Error(`Failed to load wallet: ${error.message}`);
            }
        }
        return this;
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
