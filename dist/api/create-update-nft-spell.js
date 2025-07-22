"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpdateNftSpell = createUpdateNftSpell;
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const charms_sdk_1 = require("../core/charms-sdk");
const spell_operations_1 = require("./spell-operations");
async function createUpdateNftSpell(context, feeRate, previousNftTxid, grailState, fundingUtxo) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const grailAddress = (0, taproot_1.generateGrailPaymentAddress)(grailState, context.network);
    const fundingChangeAddress = await bitcoinClient.getAddress();
    if (!fundingUtxo) {
        fundingUtxo = await bitcoinClient.getFundingUtxo();
    }
    const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxhex);
    console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
    if (!previousSpellData) {
        throw new Error('Invalid previous NFT spell data');
    }
    const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
    const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;
    const request = {
        fundingUtxo,
        fundingChangeAddress,
        feeRate,
        previousNftTxid,
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeysAsString: grailState.publicKeys.join(','),
            threshold: grailState.threshold,
        },
        toYamlObj: function () {
            return {
                version: 4,
                apps: { $00: `n/${context.appId}/${context.appVk}` },
                public_inputs: { $00: { action: 'update' } },
                ins: [
                    {
                        utxo_id: `${previousNftTxid}:0`,
                        charms: {
                            $00: {
                                ticker: context.ticker,
                                current_cosigners: previousPublicKeys,
                                current_threshold: previousThreshold,
                            },
                        },
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
                ],
            };
        },
    };
    return await (0, spell_operations_1.createUpdatingSpell)(context, request, [previousNftTxid], { publicKeys: previousPublicKeys, threshold: previousThreshold }, grailState, null);
}
