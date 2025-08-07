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
const logger_1 = require("../core/logger");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const taproot_1 = require("../core/taproot");
const charms_sdk_1 = require("../core/charms-sdk");
const spell_operations_1 = require("./spell-operations");
const spells_1 = require("../core/spells");
const array_utils_1 = require("../core/array-utils");
const bitcoin_1 = require("../core/bitcoin");
const consts_1 = require("../cli/consts");
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
async function sanityCheck(context, previousTransactions, generalizedInfo) {
    if (!generalizedInfo.outgoingGrailBtc) {
        throw new Error('Outgoing Grail BTC is required in generalizedInfo');
    }
    // Let's check each user gets the correct amount of BTC
    for (const outgoing of generalizedInfo.outgoingUserBtc) {
        const upd = generalizedInfo.incomingUserCharms.find(incoming => incoming.userWalletAddress === outgoing.address);
        if (!upd) {
            throw new Error(`Outgoing BTC to ${outgoing.address} not matched by incoming charms`);
        }
        const amount = await (0, spells_1.getCharmsAmountFromUtxo)(context, upd);
        if (amount !== outgoing.amount) {
            throw new Error(`Outgoing BTC amount ${outgoing.amount} does not match incoming charms ${amount} for address ${outgoing.address}`);
        }
    }
    // Let's check each user gets the correct amount of charms
    for (const outgoing of generalizedInfo.outgoingUserCharms) {
        const upd = generalizedInfo.incomingUserBtc.find(incoming => incoming.userWalletAddress === outgoing.address);
        if (!upd) {
            throw new Error(`Outgoing charms to ${outgoing.address} not matched by incoming BTC`);
        }
        const amount = getAmountFromUtxo(previousTransactions, upd);
        if (amount !== outgoing.amount) {
            throw new Error(`Outgoing charms amount ${outgoing.amount} does not match incoming ${amount} for address ${outgoing.address}`);
        }
    }
    // No output amount is allowed to be lower than dust limit
    for (const outgoing of [
        ...generalizedInfo.outgoingUserBtc,
        ...generalizedInfo.outgoingUserCharms,
    ]) {
        if (outgoing.amount < bitcoin_1.DUST_LIMIT) {
            throw new Error(`Outgoing amount for address ${outgoing.address} is lower than dust limit: ${outgoing.amount} < ${bitcoin_1.DUST_LIMIT}`);
        }
    }
}
async function calculateBitcoinToLock(context, previousTransactions, generalizedInfo) {
    // Let's check that this operation does not create or destroy the total amount of BTC and Charms
    const incomingUserBtc = generalizedInfo.incomingUserBtc
        .map(payment => getAmountFromUtxo(previousTransactions, payment))
        .reduce((a, b) => a + b, 0);
    const incomingUserCharms = (await (0, array_utils_1.mapAsync)(generalizedInfo.incomingUserCharms, utxo => (0, spells_1.getCharmsAmountFromUtxo)(context, utxo))).reduce((a, b) => a + b, 0);
    const outgoingUserCharms = generalizedInfo.outgoingUserCharms
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    const outgoingUserBtc = generalizedInfo.outgoingUserBtc
        .map(outgoing => outgoing.amount)
        .reduce((a, b) => a + b, 0);
    const incomingGrailBtc = generalizedInfo.incomingGrailBtc
        .map(utxo => getAmountFromUtxo(previousTransactions, utxo))
        .reduce((a, b) => a + b, 0);
    if (incomingUserBtc !== outgoingUserCharms) {
        throw new Error(`Incoming BTC (${incomingUserBtc}) does not match outgoing user charms (${outgoingUserCharms})`);
    }
    if (incomingUserCharms !== outgoingUserBtc) {
        throw new Error(`Incoming user charms (${incomingUserCharms}) does not match outgoing BTC (${outgoingUserBtc})`);
    }
    return incomingGrailBtc + incomingUserBtc - outgoingUserBtc;
}
async function createGeneralizedSpell(context, feerate, previousNftTxid, nextGrailState, generalizedInfo, fundingUtxo) {
    const allPreviousTxids = [
        previousNftTxid,
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
        amount: await calculateBitcoinToLock(context, previousTransactions, generalizedInfo),
        address: grailAddress,
    };
    // If under dust limit, just contribute it to the fee
    if (generalizedInfo.outgoingGrailBtc.amount <= consts_1.LOCKED_BTC_MIN_AMOUNT) {
        generalizedInfo.outgoingGrailBtc.amount = 0;
    }
    // Sanity!
    await sanityCheck(context, previousTransactions, generalizedInfo);
    const fundingChangeAddress = await context.bitcoinClient.getAddress();
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxid);
    logger_1.logger.debug('Previous NFT spell: ', previousSpellData);
    const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
    const previousThreshold = previousSpellData.outs[0].charms['$0000']
        .current_threshold;
    const previousGrailState = {
        publicKeys: previousPublicKeys,
        threshold: previousThreshold,
    };
    const charmsAmounts = await (0, array_utils_1.mapAsync)(generalizedInfo.incomingUserCharms, async (utxo) => await (0, spells_1.getCharmsAmountFromUtxo)(context, utxo));
    const request = {
        appId: context.appId,
        appVk: context.appVk,
        ticker: context.ticker,
        fundingUtxo,
        fundingChangeAddress,
        feerate,
        previousNftTxid,
        previousGrailState,
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
                    $01: {
                        action: this.generalizedInfo.outgoingGrailBtc.amount > 0
                            ? 'mint'
                            : 'burn',
                    },
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
                    ...this.generalizedInfo.incomingUserCharms.map((utxo, index) => ({
                        utxo_id: `${utxo.txid}:${utxo.vout}`,
                        charms: {
                            $01: charmsAmounts[index],
                        },
                    })),
                    ...this.generalizedInfo.incomingGrailBtc.map(utxo => ({
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
                            $01: outgoing.amount,
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
    const spell = await (0, spell_operations_1.createUpdatingSpell)(context, request, allPreviousTxids, previousGrailState, nextGrailState, generalizedInfo);
    previousTransactions[(0, bitcoin_1.txBytesToTxid)(spell.commitmentTxBytes)] =
        spell.commitmentTxBytes;
    const previousSpellMap = await (0, spell_operations_1.getPreviousGrailStateMap)(context, generalizedInfo.incomingGrailBtc.map(utxo => utxo.txid));
    const signatureRequest = {
        transactionBytes: spell.spellTxBytes,
        previousTransactions,
        inputs: [
            {
                index: 0,
                state: previousGrailState,
                script: (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network).script,
            },
            ...generalizedInfo.incomingUserBtc.map(payment => ({
                index: 0,
                state: payment.grailState,
                script: (0, taproot_1.generateSpendingScriptsForUserPayment)(payment, context.network)
                    .grail.script,
            })),
            ...generalizedInfo.incomingUserCharms.map(payment => ({
                index: 0,
                state: payment.grailState,
                script: (0, taproot_1.generateSpendingScriptsForUserPayment)(payment, context.network)
                    .grail.script,
            })),
            ...generalizedInfo.incomingGrailBtc.map(utxo => ({
                index: 0,
                state: previousSpellMap[utxo.txid],
                script: (0, taproot_1.generateSpendingScriptForGrail)(previousSpellMap[utxo.txid], context.network).script,
            })),
        ].map((input, index) => ({
            ...input,
            index,
        })),
    };
    logger_1.logger.debug('Spell created: ', spell);
    return { spell, signatureRequest };
}
