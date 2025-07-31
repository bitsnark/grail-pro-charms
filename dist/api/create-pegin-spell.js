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
exports.createPeginSpell = createPeginSpell;
const logger_1 = require("../core/logger");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const json_1 = require("../core/json");
const create_generalized_spell_1 = require("./create-generalized-spell");
const spell_operations_1 = require("./spell-operations");
async function createPeginSpell(context, feerate, previousNftTxid, nextGrailState, userPaymentDetails, fundingUtxo) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const previousGrailState = await (0, spell_operations_1.getPreviousGrailState)(context, previousNftTxid);
    if (!previousGrailState) {
        throw new Error('Previous Grail state not found');
    }
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const userPaymentTxBytes = await context.bitcoinClient.getTransactionBytes(userPaymentDetails.txid);
    if (!userPaymentTxBytes) {
        throw new Error(`User payment transaction ${userPaymentDetails.txid} not found`);
    }
    const userPaymentTx = bitcoin.Transaction.fromBuffer(userPaymentTxBytes);
    const userPaymentAmount = userPaymentTx.outs[userPaymentDetails.vout].value;
    logger_1.logger.log('User payment transaction amount:', userPaymentAmount);
    const { spell, signatureRequest } = await (0, create_generalized_spell_1.createGeneralizedSpell)(context, feerate, previousNftTxid, nextGrailState, {
        incomingUserBtc: [userPaymentDetails],
        incomingUserCharms: [],
        incomingGrailBtc: [],
        outgoingUserCharms: [
            {
                amount: userPaymentAmount,
                address: userPaymentDetails.userWalletAddress,
            },
        ],
        outgoingUserBtc: [],
    }, fundingUtxo);
    logger_1.logger.log('Peg-in spell created:', JSON.stringify(spell, json_1.bufferReplacer, 2));
    return { spell, signatureRequest };
}
