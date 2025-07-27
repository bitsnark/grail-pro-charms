"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const charms_sdk_1 = require("./charms-sdk");
const bitcoin_1 = require("./bitcoin");
const crypto_1 = require("bitcoinjs-lib/src/crypto");
function assertFileExists(desc, path) {
    if (!node_fs_1.default.existsSync(path || '')) {
        throw new Error(`File not found, desc: ${desc}, path: ${path}`);
    }
}
class Context {
    // Private constructor to enforce use of static create method
    constructor() { }
    static async create(obj) {
        const thus = new Context();
        // assertFileExists('charmsBin', obj.charmsBin);
        thus.charmsBin = obj.charmsBin;
        // assertFileExists('zkAppBin', obj.zkAppBin);
        thus.zkAppBin = obj.zkAppBin;
        if (!obj.appId)
            throw new Error('App ID is required');
        thus.appId = obj.appId;
        console.log('App ID:', thus.appId);
        //temp heard coded
        thus.temporarySecret =
            Buffer.from('9123890ee3891942f4866e427f9b4d276d09336d78325192fc308b2cfbc64558', 'hex');
        thus.network = obj.network || 'regtest';
        thus.mockProof = obj.mockProof || false;
        if (!obj.appVk) {
            console.warn('App VK is not provided, using charms app vk command to retrieve it');
            thus.appVk = await (0, charms_sdk_1.getVerificationKey)(thus);
        }
        else {
            thus.appVk = obj.appVk;
        }
        console.log('App Verification Key:', thus.appVk);
        if (!obj.ticker)
            throw new Error('Ticker is required');
        thus.ticker = obj.ticker;
        if (obj.bitcoinClient) {
            thus.bitcoinClient = obj.bitcoinClient;
        }
        else {
            thus.bitcoinClient = await bitcoin_1.BitcoinClient.initialize(undefined, obj.beWalletName);
        }
        return thus;
    }
    static async createForDeploy(obj, fundingUtxo) {
        const appId = (0, crypto_1.sha256)(Buffer.from(`${fundingUtxo.txid}:${fundingUtxo.vout}`, 'ascii')).toString('hex');
        return Context.create({ ...obj, appId });
    }
}
exports.Context = Context;
