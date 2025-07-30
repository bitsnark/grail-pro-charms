"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpdateNftSpell = createUpdateNftSpell;
const bitcoin_1 = require("../core/bitcoin");
const types_1 = require("../core/types");
const charms_sdk_1 = require("../core/charms-sdk");
const create_generalized_spell_1 = require("./create-generalized-spell");
const json_1 = require("../core/json");
async function createUpdateNftSpell(context, feerate, previousNftTxid, grailState, fundingUtxo) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    if (!fundingUtxo) {
        fundingUtxo = await bitcoinClient.getFundingUtxo();
    }
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxid);
    console.log('Previous NFT spell:', JSON.stringify(previousSpellData, json_1.bufferReplacer, 2));
    if (!previousSpellData) {
        throw new Error('Invalid previous NFT spell data');
    }
    return await (0, create_generalized_spell_1.createGeneralizedSpell)(context, feerate, previousNftTxid, grailState, types_1.generalizeInfoBlank, fundingUtxo);
}
