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
const bitcoin = __importStar(require("bitcoinjs-lib"));
const taproot_1 = require("../core/taproot");
const charms_sdk_1 = require("../core/charms-sdk");
const json_1 = require("../core/json");
const spell_operations_1 = require("./spell-operations");
async function createPeginSpell(context, feerate, previousNftTxid, nextGrailState, userPaymentDetails, userWalletAddress, fundingUtxo) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const grailAddress = (0, taproot_1.generateGrailPaymentAddress)(nextGrailState, context.network);
    const fundingChangeAddress = await context.bitcoinClient.getAddress();
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxhex);
    console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
    const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
    const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;
    const userPaymentTxHex = await context.bitcoinClient.getTransactionHex(userPaymentDetails.txid);
    if (!userPaymentTxHex) {
        throw new Error(`User payment transaction ${userPaymentDetails.txid} not found`);
    }
    const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
    const userPaymentAmount = userPaymentTx.outs[userPaymentDetails.vout].value;
    console.log('User payment transaction amount:', userPaymentAmount);
    const request = {
        fundingUtxo,
        fundingChangeAddress,
        feerate,
        previousNftTxid,
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeysAsString: nextGrailState.publicKeys.join(','),
            threshold: nextGrailState.threshold,
        },
        amount: userPaymentAmount,
        userWalletAddress,
        toYamlObj: function () {
            return {
                version: 4,
                apps: {
                    $00: `n/${context.appId}/${context.appVk}`,
                    $01: `t/${context.appId}/${context.appVk}`,
                },
                public_inputs: {
                    $00: { action: 'update' },
                    $01: { action: 'mint' },
                },
                ins: [
                    {
                        utxo_id: `${previousNftTxid}:0`,
                        charms: {
                            $00: {
                                ticker: context.ticker,
                                current_cosigners: previousPublicKeys.join(','),
                                current_threshold: previousThreshold,
                            },
                        },
                    },
                    {
                        utxo_id: `${userPaymentDetails.txid}:${userPaymentDetails.vout}`,
                    },
                ],
                outs: [
                    {
                        address: this.nextNftAddress,
                        charms: {
                            $00: {
                                ticker: context.ticker,
                                current_cosigners: this.currentNftState.publicKeysAsString,
                                current_threshold: this.currentNftState.threshold,
                            },
                        },
                    },
                    {
                        address: this.nextNftAddress,
                        amount: this.amount,
                    },
                    {
                        address: this.userWalletAddress,
                        charms: {
                            $01: {
                                amount: this.amount,
                            },
                        },
                    },
                ],
            };
        },
    };
    const spell = await (0, spell_operations_1.createUpdatingSpell)(context, request, [previousNftTxid, userPaymentDetails.txid], { publicKeys: previousPublicKeys, threshold: previousThreshold }, nextGrailState, userPaymentDetails);
    console.log('Peg-in spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    return spell;
}
