"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMintSpell = createMintSpell;
const logger_1 = require("../core/logger");
const create_generalized_spell_1 = require("./create-generalized-spell");
const spell_operations_1 = require("./spell-operations");
async function createMintSpell(context, feerate, previousNftTxid, amount, userWalletAddress, fundingUtxo) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const previousGrailState = await (0, spell_operations_1.getPreviousGrailState)(context, previousNftTxid);
    if (!previousGrailState) {
        throw new Error('Previous Grail state not found');
    }
    fundingUtxo = fundingUtxo || (await context.bitcoinClient.getFundingUtxo());
    const { spell, signatureRequest } = await (0, create_generalized_spell_1.createGeneralizedSpell)(context, feerate, previousNftTxid, previousGrailState, {
        disableSanity: true, // Disable sanity check for minting
        incomingUserBtc: [],
        incomingUserCharms: [],
        incomingGrailBtc: [],
        outgoingUserCharms: [
            {
                amount: amount,
                address: userWalletAddress,
            },
        ],
        outgoingUserBtc: [],
    }, fundingUtxo);
    logger_1.logger.debug('Mint spell created: ', spell);
    return { spell, signatureRequest };
}
