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
exports.createGeneralizedSpell = createGeneralizedSpell;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const taproot_1 = require("../core/taproot");
const charms_sdk_1 = require("../core/charms-sdk");
const json_1 = require("../core/json");
const spell_operations_1 = require("./spell-operations");
const spells_1 = require("../core/spells");
const array_utils_1 = require("../core/array-utils");
const bitcoin_1 = require("../core/bitcoin");
function getAmountFromUtxo(previousTransactions, utxo) {
    if (!previousTransactions[utxo.txid]) {
        throw new Error(`Transaction ${utxo.txid} not found in previous transactions`);
    }
    const tx = bitcoin.Transaction.fromBuffer(previousTransactions[utxo.txid]);
    if (utxo.vout >= tx.outs.length) {
        throw new Error(`Output index ${utxo.vout} out of bounds for transaction ${utxo.txid}`);
    }
    return tx.outs[utxo.vout].value;
}
function isAddressInInputs(previousTransactions, txid, address) {
    const tx = bitcoin.Transaction.fromBuffer(previousTransactions[txid]);
    for (const input of tx.ins) {
        const inputTxid = bitcoin.crypto.hash256(input.hash).toString('hex');
        if (inputTxid === address) {
            return true;
        }
    }
    return false;
}
async function sanityCheck(context, previousTransactions, generalizedInfo) {
    if (!generalizedInfo.outgoingGrailBtc) {
        throw new Error('Outgoing Grail BTC is required in generalizedInfo');
    }
    // Let's check each user gets the correct amount of BTC
    for (const outgoing of generalizedInfo.outgoingUserBtc) {
        const upd = generalizedInfo.incomingUserCharms.find(incoming => isAddressInInputs(previousTransactions, incoming.txid, outgoing.address));
        if (!upd) {
            throw new Error(`Outgoing BTC to ${outgoing.address} not matched by incoming charms`);
        }
        const amount = getAmountFromUtxo(previousTransactions, upd);
        if (amount !== outgoing.amount) {
            throw new Error(`Outgoing BTC amount ${outgoing.amount} does not match incoming charms ${amount} for address ${outgoing.address}`);
        }
    }
    // Let's check each user gets the correct amount of charms
    for (const outgoing of generalizedInfo.outgoingUserCharms) {
        const upd = generalizedInfo.incomingUserBtc.find(incoming => isAddressInInputs(previousTransactions, incoming.txid, outgoing.address));
        if (!upd) {
            throw new Error(`Outgoing charms to ${outgoing.address} not matched by incoming BTC`);
        }
        const amount = getAmountFromUtxo(previousTransactions, upd);
        if (amount !== outgoing.amount) {
            throw new Error(`Outgoing charms amount ${outgoing.amount} does not match incoming ${amount} for address ${outgoing.address}`);
        }
    }
    // Let's check that this operation does not create or destroy the total amount of BTC and Charms
    const totalIncomingBtc = [
        ...generalizedInfo.incomingUserBtc,
        ...generalizedInfo.incomingGrailBtc,
    ]
        .map(payment => getAmountFromUtxo(previousTransactions, payment))
        .reduce((a, b) => a + b, 0);
    const totalIncomingCharms = (await (0, array_utils_1.mapAsync)(generalizedInfo.incomingUserCharms, utxo => (0, spells_1.getCharmsAmountFromUtxo)(context, utxo))).reduce((a, b) => a + b, 0);
    const totalOutgoingBtc = [
        ...generalizedInfo.outgoingUserBtc,
        generalizedInfo.outgoingGrailBtc,
    ]
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    const totalOutgoingCharms = generalizedInfo.outgoingUserCharms
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    if (totalIncomingBtc + totalIncomingCharms !==
        totalOutgoingBtc + totalOutgoingCharms) {
        throw new Error(`Total incoming (${totalIncomingBtc} BTC + ${totalIncomingCharms} Charms) does not match total outgoing (${totalOutgoingBtc} BTC + ${totalOutgoingCharms} Charms)`);
    }
    // No output amount is allowed to be lower than dust limit
    for (const outgoing of [
        ...generalizedInfo.outgoingUserBtc,
        ...generalizedInfo.outgoingUserCharms,
        generalizedInfo.outgoingGrailBtc,
    ]) {
        if (outgoing.amount < bitcoin_1.DUST_LIMIT) {
            throw new Error(`Outgoing amount for address ${outgoing.address} is lower than dust limit: ${outgoing.amount} < ${bitcoin_1.DUST_LIMIT}`);
        }
    }
}
async function calculateExcessBitcoin(context, previousTransactions, generalizedInfo) {
    // Let's check that this operation does not create or destroy the total amount of BTC and Charms
    const totalIncomingBtc = [
        ...generalizedInfo.incomingUserBtc,
        ...generalizedInfo.incomingGrailBtc,
    ]
        .map(payment => getAmountFromUtxo(previousTransactions, payment))
        .reduce((a, b) => a + b, 0);
    const totalIncomingCharms = (await (0, array_utils_1.mapAsync)(generalizedInfo.incomingUserCharms, utxo => (0, spells_1.getCharmsAmountFromUtxo)(context, utxo))).reduce((a, b) => a + b, 0);
    const totalOutgoingBtc = generalizedInfo.outgoingUserBtc
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    const totalOutgoingCharms = generalizedInfo.outgoingUserCharms
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    return (totalIncomingBtc +
        totalIncomingCharms -
        totalOutgoingBtc -
        totalOutgoingCharms);
}
async function createGeneralizedSpell(context, feerate, previousNftTxid, nextGrailState, generalizedInfo, fundingUtxo) {
    const allPreviousTxids = [
        ...generalizedInfo.incomingGrailBtc.map(utxo => utxo.txid),
        ...generalizedInfo.incomingUserBtc.map(payment => payment.txid),
        ...generalizedInfo.incomingUserCharms.map(utxo => utxo.txid),
    ];
    const previousTransactions = await context.bitcoinClient.getTransactionsMap(allPreviousTxids);
    const grailAddress = (0, taproot_1.generateGrailPaymentAddress)(nextGrailState, context.network);
    if (generalizedInfo.outgoingGrailBtc) {
        throw new Error('outgoingGrailBtc should not be defined in generalizedInfo');
    }
    generalizedInfo.outgoingGrailBtc = {
        amount: await calculateExcessBitcoin(context, previousTransactions, generalizedInfo),
        address: grailAddress,
    };
    // Sanity!
    await sanityCheck(context, previousTransactions, generalizedInfo);
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const fundingChangeAddress = await context.bitcoinClient.getAddress();
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxhex);
    console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
    const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
    const previousThreshold = previousSpellData.outs[0].charms['$0000']
        .current_threshold;
    const request = {
        appId: context.appId,
        appVk: context.appVk,
        ticker: context.ticker,
        fundingUtxo,
        fundingChangeAddress,
        feerate,
        previousNftTxid,
        previousGrailState: {
            publicKeys: previousPublicKeys,
            threshold: previousThreshold,
        },
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeysAsString: nextGrailState.publicKeys.join(','),
            threshold: nextGrailState.threshold,
        },
        generalizedInfo,
        toYamlObj: function () {
            return {
                version: 4,
                apps: {
                    $00: `n/${this.appId}/${this.appVk}`,
                    $01: `t/${this.appId}/${this.appVk}`,
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
                                ticker: this.ticker,
                                current_cosigners: this.previousGrailState.publicKeys.join(','),
                                current_threshold: this.previousGrailState.threshold,
                            },
                        },
                    },
                    ...this.generalizedInfo.incomingUserBtc.map(payment => ({
                        utxo_id: `${payment.txid}:${payment.vout}`,
                    })),
                    ...this.generalizedInfo.incomingGrailBtc.map(utxo => ({
                        utxo_id: `${utxo.txid}:${utxo.vout}`,
                    })),
                    ...this.generalizedInfo.incomingUserCharms.map(utxo => ({
                        utxo_id: `${utxo.txid}:${utxo.vout}`,
                    })),
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
                    ...this.generalizedInfo.outgoingUserBtc.map(outgoing => ({
                        address: outgoing.address,
                        amount: outgoing.amount,
                        charms: {
                            $00: {
                                type: 'user_btc',
                            },
                        },
                    })),
                    ...this.generalizedInfo.outgoingUserCharms.map(outgoing => ({
                        address: outgoing.address,
                        charms: {
                            $00: {
                                type: 'user_charms',
                            },
                            $01: {
                                amount: outgoing.amount,
                            },
                        },
                    })),
                    this.generalizedInfo.outgoingGrailBtc.amount > 0
                        ? {
                            address: this.nextNftAddress,
                            amount: this.generalizedInfo.outgoingGrailBtc.amount,
                            charms: {
                                $00: {
                                    type: 'grail_btc',
                                },
                            },
                        }
                        : undefined,
                ].filter(Boolean),
            };
        },
    };
    const spell = await (0, spell_operations_1.createUpdatingSpell)(context, request, allPreviousTxids, { publicKeys: previousPublicKeys, threshold: previousThreshold }, nextGrailState, generalizedInfo);
    console.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    return spell;
}
