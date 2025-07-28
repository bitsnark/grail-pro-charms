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
exports.getPreviousGrailStateMap = getPreviousGrailStateMap;
exports.createUpdatingSpell = createUpdatingSpell;
exports.injectSignaturesIntoSpell = injectSignaturesIntoSpell;
exports.transmitSpell = transmitSpell;
exports.getPreviousTransactions = getPreviousTransactions;
exports.signAsCosigner = signAsCosigner;
exports.findUserPaymentVout = findUserPaymentVout;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const taproot_1 = require("../core/taproot");
const spells_1 = require("../core/spells");
const charms_sdk_1 = require("../core/charms-sdk");
const taproot_common_1 = require("../core/taproot/taproot-common");
const bitcoin_1 = require("../core/bitcoin");
async function getPreviousGrailState(context, previousNftTxid) {
    const previousSpellData = await (0, charms_sdk_1.showSpell)(context, previousNftTxid);
    if (!previousSpellData) {
        throw new Error('Invalid previous NFT spell data');
    }
    return {
        publicKeys: previousSpellData.outs[0].charms['$0000'].current_cosigners.split(','),
        threshold: previousSpellData.outs[0].charms['$0000'].current_threshold,
    };
}
async function getPreviousGrailStateMap(context, txids) {
    const previousGrailStates = {};
    for (const txid of txids) {
        previousGrailStates[txid] = await getPreviousGrailState(context, txid);
    }
    return previousGrailStates;
}
async function createUpdatingSpell(context, request, previousTxIds, previousGrailState, nextGrailState, generalizedInfo) {
    const spell = await (0, spells_1.createSpell)(context, previousTxIds, request);
    const inputIndexNft = 0; // Assuming the first input is the NFT input
    const spellTx = bitcoin.Transaction.fromBuffer(spell.spellTxBytes);
    const spendingScriptGrail = (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network);
    spellTx.ins[inputIndexNft].witness = [
        // bitcoin.script.compile([bitcoin.opcodes.OP_CODESEPARATOR]),
        spendingScriptGrail.script,
        spendingScriptGrail.controlBlock,
    ];
    let userInputIndex = inputIndexNft + 1;
    for (const input of generalizedInfo.incomingUserBtc) {
        const spendingScriptUser = (0, taproot_1.generateSpendingScriptsForUserPayment)(input, context.network);
        spellTx.ins[userInputIndex++].witness = [
            spendingScriptUser.grail.script,
            spendingScriptUser.grail.controlBlock,
        ];
    }
    spell.spellTxBytes = spellTx.toBuffer();
    return spell;
}
function injectGrailSignaturesIntoTxInput(txBytes, inputIndex, signatures) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(txBytes);
    // Witness: [signatures] [tapleaf script] [control block]
    tx.ins[inputIndex].witness = [...signatures, ...tx.ins[inputIndex].witness];
    return tx.toBuffer();
}
async function injectSignaturesIntoSpell(context, spell, signatureRequest, fromCosigners) {
    // Clone it so we own it
    spell = { ...spell };
    // Prepare signatures for injection by input index
    const signaturesByIndex = [];
    for (const input of signatureRequest.inputs) {
        // Extract the signatures for this input, but only for the cosigners that are part of its Grail state
        const labeledSignatures = fromCosigners
            .filter(ti => input.state.publicKeys.find(pk => pk === ti.publicKey))
            .map(ti => {
            const lsigs = ti.signatures.filter(sig => sig.index === input.index);
            if (lsigs.length > 1)
                throw new Error(`Multiple signatures for input ${input.index} from cosigner ${ti.publicKey}`);
            return { publicKey: ti.publicKey, signature: lsigs[0].signature };
        });
        // Do we have enbough signatures?
        if (labeledSignatures.length < input.state.threshold) {
            throw new Error(`Not enough signatures for input ${input.index}. Required: ${input.state.threshold}, provided: ${labeledSignatures.length}`);
        }
        // We only need enough for the threshold
        labeledSignatures.length = input.state.threshold;
        // Now we need to sort them and insert 0 where missing
        const signaturesOrdered = input.state.publicKeys.map((pk) => labeledSignatures.find(lsig => lsig.publicKey === pk)?.signature ||
            Buffer.from([]));
        signaturesByIndex[input.index] = signaturesOrdered;
    }
    for (let index = 0; index < signaturesByIndex.length; index++) {
        const signatures = signaturesByIndex[index];
        if (!signatures || signatures.length === 0) {
            continue; // No signatures for this input
        }
        spell.spellTxBytes = injectGrailSignaturesIntoTxInput(spell.spellTxBytes, index, signatures);
    }
    const commitmentTxid = (0, bitcoin_1.txBytesToTxid)(spell.commitmentTxBytes);
    spell.spellTxBytes = await (0, spells_1.resignSpellWithTemporarySecret)(context, spell.spellTxBytes, { [commitmentTxid]: spell.commitmentTxBytes }, context.temporarySecret);
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
async function getPreviousTransactions(context, spellTxBytes, commitmentTxBytes) {
    const result = commitmentTxBytes
        ? {
            [(0, bitcoin_1.txBytesToTxid)(commitmentTxBytes)]: commitmentTxBytes,
        }
        : {};
    const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
    for (const input of tx.ins) {
        const txid = (0, bitcoin_1.hashToTxid)(input.hash);
        if (!(txid in result)) {
            const txBytes = await context.bitcoinClient.getTransactionHex(txid);
            result[txid] = Buffer.from(txBytes, 'hex');
        }
    }
    return result;
}
function signAsCosigner(context, request, keypair) {
    const sigs = request.inputs.map(input => ({
        index: input.index,
        signature: (0, spells_1.signTransactionInput)(context, request.transactionBytes, input.index, input.script, request.previousTransactions, keypair),
    }));
    return sigs;
}
async function findUserPaymentVout(context, grailState, userPaymentDetails) {
    const userPaymentTxHex = await context.bitcoinClient.getTransactionHex(userPaymentDetails.txid);
    if (!userPaymentTxHex) {
        throw new Error(`User payment transaction ${userPaymentDetails.txid} not found`);
    }
    const userPaymentTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)(grailState, userPaymentDetails, context.network);
    const index = userPaymentTx.outs.findIndex(out => {
        // Convert address to script and compare
        const outScript = bitcoin.address.toOutputScript(userPaymentAddress, taproot_common_1.bitcoinjslibNetworks[context.network]);
        return out.script.compare(outScript) == 0;
    });
    if (index === -1) {
        throw new Error(`User payment address ${userPaymentAddress} not found in transaction ${userPaymentDetails.txid}`);
    }
    return index;
}
