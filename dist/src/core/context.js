"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const logger_1 = require("./logger");
const charms_sdk_1 = require("./charms-sdk");
const node_crypto_1 = require("node:crypto");
const crypto_1 = require("bitcoinjs-lib/src/crypto");
const bitcoin_1 = require("./bitcoin");
const env_parser_1 = require("./env-parser");
class Context {
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
        logger_1.logger.info('App ID: ', thus.appId);
        thus.network = obj.network || 'regtest';
        thus.mockProof = obj.mockProof || false;
        thus.skipProof = obj.skipProof || false;
        const charmsSecret = env_parser_1.parse.string('CHARMS_SECRET', '')
            ? Buffer.from(env_parser_1.parse.string('CHARMS_SECRET'), 'hex')
            : (0, node_crypto_1.randomBytes)(32);
        thus.temporarySecret = charmsSecret;
        if (!obj.appVk) {
            logger_1.logger.warn('App VK is not provided, using charms app vk command to retrieve it');
            thus.appVk = await (0, charms_sdk_1.getVerificationKey)(thus);
        }
        else {
            thus.appVk = obj.appVk;
        }
        logger_1.logger.info('App Verification Key: ', thus.appVk);
        thus.bitcoinClient = await bitcoin_1.BitcoinClient.initialize(obj.core);
        return thus;
    }
    static async createForDeploy(obj, fundingUtxo) {
        const appId = (0, crypto_1.sha256)(Buffer.from(`${fundingUtxo.txid}:${fundingUtxo.vout}`, 'ascii')).toString('hex');
        return Context.create({ ...obj, appId });
    }
    static async createForVisualize(obj) {
        const context = await Context.create({
            ...obj,
            appId: 'visualize',
            appVk: 'visualize',
            zkAppBin: env_parser_1.parse.string('ZKAPP_BIN', 'zkapp'),
        });
        return context;
    }
}
exports.Context = Context;
