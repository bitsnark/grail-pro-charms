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
exports.findLockedBtcUtxos = findLockedBtcUtxos;
exports.createPegoutSpell = createPegoutSpell;
const logger_1 = require("../core/logger");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const json_1 = require("../core/json");
const create_generalized_spell_1 = require("./create-generalized-spell");
const spell_operations_1 = require("./spell-operations");
const bitcoin_1 = require("../core/bitcoin");
const spells_1 = require("../core/spells");
const taproot_1 = require("../core/taproot");
const taproot_common_1 = require("../core/taproot/taproot-common");
const array_utils_1 = require("../core/array-utils");
const consts_1 = require("../cli/consts");
async function findLockedBtcUtxos(context, lastNftTxid, minAmount) {
    const selectedUtxos = [];
    let totalAmount = 0;
    let nftTxid = lastNftTxid;
    while (nftTxid) {
        const state = await (0, spells_1.getStateFromNft)(context, nftTxid); // Ensure the state is fetched
        if (!state)
            break;
        const grailAddress = (0, taproot_1.generateGrailPaymentAddress)(state, context.network);
        const tx = bitcoin.Transaction.fromBuffer(await context.bitcoinClient.getTransactionBytes(nftTxid));
        const outputScript = bitcoin.address.toOutputScript(grailAddress, taproot_common_1.bitcoinjslibNetworks[context.network]);
        const utxos = tx.outs
            .map((out, index) => ({
            txid: nftTxid,
            vout: index,
            value: out.value,
            script: out.script,
        }))
            .filter(utxo => utxo.value >= consts_1.LOCKED_BTC_MIN_AMOUNT && utxo.script.equals(outputScript));
        const unspent = await (0, array_utils_1.filterAsync)(utxos, async (utxo) => {
            return await context.bitcoinClient.isUtxoSpendable(utxo.txid, utxo.vout);
        });
        selectedUtxos.push(...unspent);
        nftTxid = tx.ins[0] ? (0, bitcoin_1.hashToTxid)(tx.ins[0].hash) : null;
    }
    if (totalAmount < minAmount) {
        throw new Error(`Not enough BTC locked UTXOs found. Required: ${minAmount}`);
    }
    return selectedUtxos;
}
async function createPegoutSpell(context, feerate, previousNftTxid, nextGrailState, userPaymentDetails, fundingUtxo) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const previousGrailState = await (0, spell_operations_1.getPreviousGrailState)(context, previousNftTxid);
    if (!previousGrailState) {
        throw new Error('Previous Grail state not found');
    }
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const userPaymentAmount = await (0, spells_1.getCharmsAmountFromUtxo)(context, userPaymentDetails);
    logger_1.logger.log('User payment transaction amount: ', userPaymentAmount);
    const lockedBtcUtxos = await findLockedBtcUtxos(context, previousNftTxid, userPaymentAmount);
    const { spell, signatureRequest } = await (0, create_generalized_spell_1.createGeneralizedSpell)(context, feerate, previousNftTxid, nextGrailState, {
        incomingUserBtc: [userPaymentDetails],
        incomingUserCharms: [userPaymentDetails],
        incomingGrailBtc: lockedBtcUtxos,
        outgoingUserCharms: [],
        outgoingUserBtc: [
            {
                amount: userPaymentAmount,
                address: userPaymentDetails.userWalletAddress,
            },
        ],
    }, fundingUtxo);
    logger_1.logger.log('Peg-in spell created:', JSON.stringify(spell, json_1.bufferReplacer, 2));
    return { spell, signatureRequest };
}
