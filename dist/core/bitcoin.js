"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinClient = exports.ExtendedClient = exports.DUST_LIMIT = void 0;
exports.txidToHash = txidToHash;
exports.hashToTxid = hashToTxid;
exports.txBytesToTxid = txBytesToTxid;
exports.txHexToTxid = txHexToTxid;
const bitcoin_core_1 = __importDefault(require("bitcoin-core"));
const bitcoin = __importStar(require("bitcoinjs-lib"));
exports.DUST_LIMIT = 546;
function txidToHash(txid) {
    return Buffer.from(txid, 'hex').reverse();
}
function hashToTxid(hash) {
    // This is a hack to avoid Buffer.reverse() which behaves unexpectedly
    return Buffer.from(Array.from(hash).reverse()).toString('hex');
}
function txBytesToTxid(txBytes) {
    return bitcoin.Transaction.fromBuffer(txBytes).getId();
}
function txHexToTxid(txHex) {
    const txBytes = Buffer.from(txHex, 'hex');
    return txBytesToTxid(txBytes);
}
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
    getTxOut(txid, vout, includeMempool = true) {
        return this.command('gettxout', txid, vout, includeMempool);
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
        if (BitcoinClient.txhash[txid]) {
            return BitcoinClient.txhash[txid].toString('hex');
        }
        const tx = (await this.client.getRawTransaction(txid));
        BitcoinClient.txhash[txid] = Buffer.from(tx.hex, 'hex');
        return tx.hex;
    }
    async getTransactionBytes(txid) {
        if (BitcoinClient.txhash[txid]) {
            return BitcoinClient.txhash[txid];
        }
        const txHex = await this.getTransactionHex(txid);
        return Buffer.from(txHex, 'hex');
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
    async getTransactionsBytes(txids) {
        const transactions = [];
        for (const txid of txids) {
            const tx = await this.getTransactionBytes(txid);
            transactions.push(tx);
        }
        return transactions;
    }
    async getTransactionsMap(txids) {
        const transactions = await this.getTransactionsBytes(txids);
        return transactions.reduce((acc, txBytes) => {
            acc[txBytesToTxid(txBytes)] = txBytes;
            return acc;
        }, {});
    }
    async isUtxoSpendable(txid, vout) {
        return !!(await this.client.getTxOut(txid, vout, true));
    }
}
exports.BitcoinClient = BitcoinClient;
BitcoinClient.txhash = {};
