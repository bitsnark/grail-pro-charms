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
exports.getAddressFromScript = getAddressFromScript;
const bitcoin_core_1 = __importDefault(require("bitcoin-core"));
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecc = __importStar(require("tiny-secp256k1"));
const taproot_common_1 = require("./taproot/taproot-common");
const logger_1 = require("./logger");
const env_parser_1 = require("./env-parser");
bitcoin.initEccLib(ecc);
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
function getAddressFromScript(script, network) {
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
                network: taproot_common_1.bitcoinjslibNetworks[network],
            }).address;
        }
        catch (error) {
            logger_1.logger.devnull(error);
            return undefined;
        }
    })
        .filter(Boolean)[0];
    if (!address) {
        return script.toString('hex'); // Fallback to hex representation if no address found
    }
    return address;
}
class ExtendedClient {
    constructor(client) {
        this.client = client;
    }
    getRawTransaction(txid) {
        return this.client.command('getrawtransaction', txid, true);
    }
    sendRawTransaction(txHex) {
        return this.client.command('sendrawtransaction', txHex);
    }
    signTransactionInputs(txHex, prevtxs, sighashType) {
        return this.client.command('signrawtransactionwithwallet', txHex, prevtxs, sighashType);
    }
    listUnspent(minconf, maxconf, addresses) {
        return this.client.command('listunspent', minconf, maxconf, addresses);
    }
    getNewAddress() {
        return this.client.command('getnewaddress');
    }
    loadWallet(name) {
        return this.client.command('loadwallet', name);
    }
    unloadWallet(name) {
        return this.client.command('unloadwallet', name);
    }
    sendToAddress(toAddress, amountBtc) {
        return this.client.command('sendtoaddress', toAddress, amountBtc);
    }
    getTxOut(txid, vout, includeMempool = true) {
        return this.client.command('gettxout', txid, vout, includeMempool);
    }
    generateToAddress(blocks, address) {
        return this.client.command('generatetoaddress', blocks, address);
    }
    generateBlocks(address, txids) {
        return this.client.command('generateblock', address, txids);
    }
}
exports.ExtendedClient = ExtendedClient;
class BitcoinClient {
    constructor() {
        this.client = null;
        this.mempoolUrl = env_parser_1.parse.string('MEMPOOL_URL', 'https://mempool.space/api');
    }
    static async initialize(client) {
        const thus = new BitcoinClient();
        if (client) {
            thus.client = new ExtendedClient(client);
        }
        else {
            thus.client = new ExtendedClient(new bitcoin_core_1.default({
                username: env_parser_1.parse.string('BTC_NODE_USERNAME', 'bitcoin'),
                password: env_parser_1.parse.string('BTC_NODE_PASSWORD', '1234'),
                host: env_parser_1.parse.string('BTC_NODE_HOST', 'http://localhost:18443'),
                timeout: 30000, // 30 seconds
            }));
            const walletName = env_parser_1.parse.string('BTC_WALLET_NAME', 'default');
            try {
                await thus.client.loadWallet(walletName);
            }
            catch (error) {
                const message = error.message ?? '';
                // Check for various wallet already loaded error messages
                if (!message.includes('is already loaded') &&
                    !message.includes('Database is already opened') &&
                    !message.includes('Unable to obtain an exclusive lock')) {
                    logger_1.logger.error(error);
                    throw new Error(`Failed to load wallet: ${message}`);
                }
                // If it's a lock error, try to unload and reload
                if (message.includes('Unable to obtain an exclusive lock')) {
                    try {
                        await thus.client.unloadWallet(walletName);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                        await thus.client.loadWallet(walletName);
                    }
                    catch (error) {
                        const message = error.message ?? '';
                        throw new Error(`Failed to reload wallet after lock error: ${message}`);
                    }
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
    async signTransaction(txBytes, prevtxsBytesMap, sighashType) {
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
        const result = await this.client.signTransactionInputs(txBytes.toString('hex'), prevtxinfo, sighashType);
        if (!result.complete)
            throw new Error('Transaction signing failed');
        return Buffer.from(result.hex, 'hex');
    }
    async transmitTransaction(txBytes) {
        return this.client.sendRawTransaction(txBytes.toString('hex'));
    }
    async listUnspent(address) {
        return this.client.listUnspent(0, 9999999, address ? [address] : []).then(unspent => unspent.map(us => ({
            spendable: us.spendable,
            value: Math.floor(us.amount * 1e8), // Convert BTC to satoshis
            txid: us.txid,
            vout: us.vout,
        })));
    }
    async getAddress() {
        return this.client.getNewAddress();
    }
    async getFundingUtxo() {
        const unspent = (await this.listUnspent()).filter(utxo => utxo.spendable && utxo.value >= 10000 // 0.001 BTC minimum
        );
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
    async generateBlocks(txids) {
        const output = await this.getAddress();
        await this.client.generateBlocks(output, txids);
    }
    async generateToAddress(blocks, address) {
        return this.client.generateToAddress(blocks, address);
    }
    async getOutspends(txid) {
        const response = await fetch(`${this.mempoolUrl}/tx/${txid}/outspends`);
        if (!response.ok) {
            throw new Error(`Failed to fetch outspends: ${response.statusText}`);
        }
        return response.json();
    }
    async getExtendedTransactionData(txid) {
        const response = await fetch(`${this.mempoolUrl}/tx/${txid}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch transaction: ${response.statusText}`);
        }
        return response.json();
    }
}
exports.BitcoinClient = BitcoinClient;
BitcoinClient.txhash = {};
