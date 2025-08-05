"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransferSpell = createTransferSpell;
const logger_1 = require("../core/logger");
const bitcoin_1 = require("../core/bitcoin");
const spells_1 = require("../core/spells");
async function createTransferSpell(context, feerate, inputUtxos, outputAddress, changeAddress, amount, fundingUtxo) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    if (!fundingUtxo) {
        fundingUtxo = await bitcoinClient.getFundingUtxo();
    }
    const inputTotal = inputUtxos.reduce((sum, utxo) => sum + utxo.amount, 0);
    if (inputUtxos.length == 0 || inputTotal <= 0) {
        throw new Error('No input UTXOs provided or all amounts are zero.');
    }
    const changeAmount = inputTotal - amount;
    if (changeAmount < 0) {
        throw new Error('Insufficient input UTXOs for the specified amount.');
    }
    const fundingChangeAddress = await context.bitcoinClient.getAddress();
    const request = {
        appId: context.appId,
        appVk: context.appVk,
        inputUtxos,
        outputAddress,
        changeAddress,
        amount,
        feerate,
        changeAmount,
        fundingChangeAddress,
        fundingUtxo,
        toYamlObj: function () {
            return {
                version: 4,
                apps: {
                    $00: `t/${this.appId}/${this.appVk}`,
                },
                public_inputs: {
                    $00: { action: 'transfer' },
                },
                ins: [
                    ...this.inputUtxos.map(utxo => ({
                        utxo_id: `${utxo.txid}:${utxo.vout}`,
                        charms: { $00: utxo.amount },
                    })),
                ],
                outs: [
                    {
                        address: this.outputAddress,
                        charms: { $00: this.amount },
                    },
                    this.changeAmount > 0
                        ? {
                            address: this.changeAddress,
                            charms: { $00: this.changeAmount },
                        }
                        : null,
                ].filter(Boolean),
            };
        },
    };
    const previousTxids = inputUtxos.map(utxo => utxo.txid);
    const spell = await (0, spells_1.createSpell)(context, previousTxids, request);
    logger_1.logger.debug('Transmit spell created:', spell);
    return spell;
}
