"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpdateNftSpell = createUpdateNftSpell;
const logger_1 = require("../core/logger");
const bitcoin_1 = require("../core/bitcoin");
const charms_sdk_1 = require("../core/charms-sdk");
const create_generalized_spell_1 = require("./create-generalized-spell");
async function createUpdateNftSpell(context, feerate, previousNftTxid, grailState, fundingUtxo) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    if (!fundingUtxo) {
        fundingUtxo = await bitcoinClient.getFundingUtxo();
    }
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxid);
    logger_1.logger.debug('Previous NFT spell: ', previousSpellData);
    if (!previousSpellData) {
        throw new Error('Invalid previous NFT spell data');
    }
    // Create a fresh copy of generalizeInfoBlank to avoid mutation issues
    const freshGeneralizedInfo = {
        incomingUserBtc: [],
        incomingGrailBtc: [],
        incomingUserCharms: [],
        outgoingUserBtc: [],
        outgoingUserCharms: [],
    };
    return await (0, create_generalized_spell_1.createGeneralizedSpell)(context, feerate, previousNftTxid, grailState, freshGeneralizedInfo, {}, fundingUtxo);
}
