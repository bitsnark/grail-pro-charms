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
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawl = crawl;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bitcoin_1 = require("../core/bitcoin");
const charms_sdk_1 = require("../core/charms-sdk");
const logger_1 = require("../core/logger");
async function crawl(context, maxDepth, txid, 
/* out */ transactions = {}) {
    if (maxDepth <= 0)
        return transactions;
    try {
        const txBytes = await context.bitcoinClient.getTransactionBytes(txid);
        if (!txBytes || txBytes.length === 0)
            return transactions;
        transactions[txid] = {
            txid,
            bytes: txBytes,
            tx: bitcoin.Transaction.fromBuffer(txBytes),
        };
    }
    catch (error) {
        logger_1.logger.warn(`Error fetching transaction ${txid}:`, error);
        return transactions;
    }
    try {
        const spell = await (0, charms_sdk_1.showSpell)(context, txid);
        if (!spell)
            return transactions;
        transactions[txid].spell = spell;
    }
    catch (error) {
        logger_1.logger.warn(`Error showing spell for txid ${txid}:`, error);
        return transactions;
    }
    for (const input of transactions[txid].tx.ins) {
        const inputTxid = (0, bitcoin_1.hashToTxid)(input.hash);
        await crawl(context, maxDepth - 1, inputTxid, transactions);
    }
    return transactions;
}
