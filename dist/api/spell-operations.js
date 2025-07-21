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
exports.getPreviousGrailState = getPreviousGrailState;
exports.createUpdatingSpell = createUpdatingSpell;
exports.signSpell = signSpell;
exports.injectSignaturesIntoSpell = injectSignaturesIntoSpell;
exports.transmitSpell = transmitSpell;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const spells_1 = require("../core/spells");
const charms_sdk_1 = require("../core/charms-sdk");
async function getPreviousGrailState(context, previousNftTxid) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(previousNftTxid);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
    }
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxhex);
    if (!previousSpellData) {
        throw new Error('Invalid previous NFT spell data');
    }
    return {
        publicKeys: previousSpellData.outs[0].charms['$0000'].current_cosigners.split(','),
        threshold: previousSpellData.outs[0].charms['$0000'].current_threshold,
    };
}
async function createUpdatingSpell(context, request, previousTxIds, previousGrailState, nextGrailState, userPaymentDetails) {
    const spell = await (0, spells_1.createSpell)(context, previousTxIds, request);
    const inputIndexNft = 0; // Assuming the first input is the NFT input
    const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
    const spendingScriptGrail = (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network);
    spellTx.ins[inputIndexNft].witness = [
        // bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
        spendingScriptGrail.script,
        spendingScriptGrail.controlBlock,
    ];
    if (userPaymentDetails) {
        const bitcoinClient = await bitcoin_1.BitcoinClient.create();
        const userPaymentTxHex = await bitcoinClient.getTransactionHex(userPaymentDetails.txid);
        const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
        const userPaymentOutput = userPaymentTx.outs[userPaymentDetails.vout];
        const inputIndexUser = 1; // Assuming the second input is the user payment input
        const spendingScriptUser = (0, taproot_1.generateSpendingScriptsForUser)(nextGrailState, userPaymentDetails, context.network);
        spellTx.ins[inputIndexUser] = {
            hash: (0, spells_1.txidToHash)(userPaymentDetails.txid),
            index: userPaymentDetails.vout,
            script: Buffer.from(''),
            sequence: 0xffffffff,
            witness: [
                // bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
                spendingScriptUser.grail.script,
                spendingScriptUser.grail.controlBlock,
            ],
        };
    }
    spell.spellTxBytes = spellTx.toBuffer();
    return spell;
}
async function signSpell(context, spell, previousNftTxid, nextGrailState, userPaymentDetails, keyPairs) {
    // Clone it so we own it
    spell = { ...spell };
    const inputIndexNft = 0; // Assuming the first input is the NFT input
    const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
    const previousGrailState = await getPreviousGrailState(context, previousNftTxid);
    const spendingScriptGrail = (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network);
    spellTx.ins[inputIndexNft].witness = [
        // bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
        spendingScriptGrail.script,
        spendingScriptGrail.controlBlock,
    ];
    spell.spellTxBytes = spellTx.toBuffer();
    // Now we can sign and inject the signatures into the transaction inputs
    const nftInputSignatures = await (0, spells_1.grailSignSpellNftInput)(spell, inputIndexNft, previousGrailState, keyPairs, context.network);
    const allSignatures = [];
    allSignatures[inputIndexNft] = nftInputSignatures;
    if (userPaymentDetails) {
        const inputIndexUser = 1; // Assuming the second input is the user payment input
        const userInputSignatures = await (0, spells_1.grailSignSpellUserInput)(spell, inputIndexUser, nextGrailState, userPaymentDetails, keyPairs, context.network);
        allSignatures[inputIndexUser] = userInputSignatures;
    }
    return allSignatures;
}
async function injectSignaturesIntoSpell(context, spell, previousNftTxid, signaturePackage) {
    // Clone it so we own it
    spell = { ...spell };
    const previousGrailState = await getPreviousGrailState(context, previousNftTxid);
    for (let index = 0; index < signaturePackage.length; index++) {
        const signatures = signaturePackage[index];
        if (!signatures || signatures.length === 0) {
            continue; // No signatures for this input
        }
        spell.spellTxBytes = (0, spells_1.injectGrailSignaturesIntoTxInput)(spell.spellTxBytes, index, previousGrailState, signatures);
    }
    const commitmentTxid = (0, spells_1.txBytesToTxid)(spell.commitmentTxBytes);
    spell.spellTxBytes = await (0, spells_1.resignSpellWithTemporarySecret)(spell.spellTxBytes, { [commitmentTxid]: spell.commitmentTxBytes }, context.temporarySecret);
    return spell;
}
async function transmitSpell(context, transactions) {
    console.log('Transmitting spell...');
    const commitmentTxHex = transactions.commitmentTxBytes.toString('hex');
    const signedCommitmentTxHex = await context.bitcoinClient.signTransaction(commitmentTxHex, undefined, 'ALL|ANYONECANPAY');
    console.info('Sending commitment transaction:', signedCommitmentTxHex);
    const commitmentTxid = await context.bitcoinClient.transmitTransaction(signedCommitmentTxHex);
    const spellTransactionHex = transactions.spellTxBytes.toString('hex');
    console.info('Sending spell transaction:', spellTransactionHex);
    const spellTxid = await context.bitcoinClient.transmitTransaction(spellTransactionHex);
    const output = [commitmentTxid, spellTxid];
    console.log('Spell transmitted successfully:', output);
    return output;
}
