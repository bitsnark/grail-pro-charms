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
exports.getStateFromNft = getStateFromNft;
exports.getCharmsAmountFromUtxo = getCharmsAmountFromUtxo;
exports.signTransactionInput = signTransactionInput;
exports.verifySignatureForTransactionInput = verifySignatureForTransactionInput;
exports.resignSpellWithTemporarySecret = resignSpellWithTemporarySecret;
exports.createSpell = createSpell;
exports.getTokenInfoForUtxo = getTokenInfoForUtxo;
exports.findCharmsUtxos = findCharmsUtxos;
const logger_1 = require("./logger");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const yaml = __importStar(require("js-yaml"));
const secp256k1_1 = require("@noble/curves/secp256k1");
const charms_sdk_1 = require("./charms-sdk");
const taproot_common_1 = require("./taproot/taproot-common");
const charms_sdk_2 = require("./charms-sdk");
const bitcoin_1 = require("./bitcoin");
const array_utils_1 = require("./array-utils");
// SIGHASH type for Taproot (BIP-342)
const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;
async function getStateFromNft(context, nftTxId) {
    const previousSpellData = await (0, charms_sdk_2.showSpell)(context, nftTxId);
    logger_1.logger.debug('NFT Spell: ', previousSpellData);
    if (!previousSpellData ||
        !previousSpellData.outs ||
        previousSpellData.outs.length < 1) {
        return null;
    }
    const nftId = `n/${context.appId}/${context.appVk}`;
    const appKey = Object.keys(previousSpellData.apps).find(key => previousSpellData.apps[key] === nftId);
    if (!appKey || !previousSpellData.outs[0].charms[appKey]) {
        return null;
    }
    const previousPublicKeys = previousSpellData.outs[0].charms[appKey].current_cosigners?.split(',');
    const previousThreshold = previousSpellData.outs[0].charms[appKey].current_threshold;
    return {
        publicKeys: previousPublicKeys,
        threshold: previousThreshold,
    };
}
async function getCharmsAmountFromUtxo(context, utxo) {
    const tokenId = `t/${context.appId}/${context.appVk}`;
    const spellData = await (0, charms_sdk_2.showSpell)(context, utxo.txid);
    if (!spellData || !spellData.outs) {
        throw new Error(`No spell data found for UTXO ${utxo.txid}`);
    }
    const appKey = Object.keys(spellData.apps).find(key => spellData.apps[key] === tokenId);
    if (!appKey) {
        throw new Error(`No app key found for token ${tokenId}`);
    }
    return Number(spellData.outs[utxo.vout]?.charms[appKey] ?? 0);
}
function signTransactionInput(context, txBytes, inputIndex, script, previousTxBytesMap, keypair) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(txBytes);
    // Tapleaf version for tapscript is always 0xc0
    // BitcoinJS v6+ exposes tapleafHash for this calculation
    const tapleafHash = (0, taproot_common_1.getHash)(script);
    const previous = [];
    for (const input of tx.ins) {
        const inputTxid = (0, bitcoin_1.hashToTxid)(input.hash);
        const ttxbytes = previousTxBytesMap[inputTxid];
        if (!ttxbytes)
            throw new Error(`Input transaction ${inputTxid} not found`);
        const ttx = bitcoin.Transaction.fromBuffer(ttxbytes);
        const out = ttx.outs[input.index];
        previous.push({
            value: out.value,
            script: out.script,
        });
    }
    // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
    const sighash = tx.hashForWitnessV1(inputIndex, previous.map(p => p.script), previous.map(p => p.value), sighashType, tapleafHash);
    return Buffer.from(secp256k1_1.schnorr.sign(sighash, keypair.privateKey));
}
function verifySignatureForTransactionInput(context, txBytes, signature, inputIndex, script, previousTxBytesMap, publicKey) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(txBytes);
    // Tapleaf version for tapscript is always 0xc0
    // BitcoinJS v6+ exposes tapleafHash for this calculation
    const tapleafHash = (0, taproot_common_1.getHash)(script);
    const previous = [];
    for (const input of tx.ins) {
        const inputTxid = (0, bitcoin_1.hashToTxid)(input.hash);
        const ttxbytes = previousTxBytesMap[inputTxid];
        if (!ttxbytes)
            throw new Error(`Input transaction ${inputTxid} not found`);
        const ttx = bitcoin.Transaction.fromBuffer(ttxbytes);
        const out = ttx.outs[input.index];
        previous.push({
            value: out.value,
            script: out.script,
        });
    }
    // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
    const sighash = tx.hashForWitnessV1(inputIndex, previous.map(p => p.script), previous.map(p => p.value), sighashType, tapleafHash);
    return secp256k1_1.schnorr.verify(signature, sighash, publicKey);
}
async function resignSpellWithTemporarySecret(context, spellTxBytes, previousTxBytesMap, temporarySecret) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
    const inputIndex = tx.ins.length - 1; // Last input is the commitment
    const previous = [];
    for (const input of tx.ins) {
        let ttxBytes;
        const inputTxid = (0, bitcoin_1.hashToTxid)(input.hash);
        if (previousTxBytesMap[inputTxid]) {
            ttxBytes = previousTxBytesMap[inputTxid];
        }
        else {
            const ttxHex = await context.bitcoinClient.getTransactionHex(inputTxid);
            if (!ttxHex) {
                throw new Error(`Input transaction ${inputTxid} not found`);
            }
            ttxBytes = Buffer.from(ttxHex, 'hex');
        }
        const ttx = bitcoin.Transaction.fromBuffer(ttxBytes);
        const out = ttx.outs[input.index];
        previous.push({
            value: out.value,
            script: out.script,
        });
    }
    const script = tx.ins[inputIndex].witness[1]; // Tapleaf script
    const tapleafHash = (0, taproot_common_1.getHash)(script);
    // Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
    const sighash = tx.hashForWitnessV1(inputIndex, previous.map(p => p.script), previous.map(p => p.value), sighashType, tapleafHash);
    const signature = secp256k1_1.schnorr.sign(sighash, temporarySecret);
    const temporaryPublicKey = secp256k1_1.schnorr.getPublicKey(temporarySecret);
    if (!secp256k1_1.schnorr.verify(signature, sighash, temporaryPublicKey)) {
        throw new Error('Temporary signature verification failed');
    }
    tx.ins[inputIndex].witness[0] = Buffer.from(signature);
    return tx.toBuffer();
}
async function createSpell(context, previousTxids, request) {
    logger_1.logger.debug('Creating spell...');
    const previousTransactions = await Promise.all(previousTxids.map(async (txid) => context.bitcoinClient.getTransactionHex(txid)));
    const yamlStr = yaml.dump(request.toYamlObj());
    logger_1.logger.debug('Executing spell creation with Yaml: ', yamlStr);
    const output = await (0, charms_sdk_1.executeSpell)(context, request.fundingUtxo, request.feerate, request.fundingChangeAddress, yamlStr, previousTransactions.map(tx => Buffer.from(tx, 'hex')));
    logger_1.logger.debug('Spell created successfully: ', output);
    return {
        commitmentTxBytes: output.commitmentTxBytes,
        spellTxBytes: output.spellTxBytes,
    };
}
async function getTokenInfoForUtxo(context, utxo) {
    const spell = await (0, charms_sdk_2.showSpell)(context, utxo.txid);
    if (!spell || !spell.apps) {
        throw new Error(`No token info found for transaction ${utxo.txid}`);
    }
    const tokenId = `t/${context.appId}/${context.appVk}`;
    const appKey = Object.keys(spell.apps).find(key => spell.apps[key] === tokenId);
    if (!appKey) {
        throw new Error(`No app key found for token ${tokenId}`);
    }
    const outs = spell.outs
        .map((out, index) => ({ index, ...out.charms[appKey] }))
        .filter(Boolean);
    return (0, array_utils_1.arrayFromArrayWithIndex)(outs)[utxo.vout];
}
async function findCharmsUtxos(context, minTotal, utxos) {
    let total = 0;
    if (!utxos) {
        utxos = await context.bitcoinClient.listUnspent();
    }
    if (utxos.length === 0) {
        throw new Error('No UTXOs found');
    }
    const charmsUtxos = (await (0, array_utils_1.mapAsync)(utxos, async (utxo) => {
        logger_1.logger.debug('Checking UTXO: ', utxo);
        if (total >= minTotal)
            return { ...utxo, amount: 0 };
        const info = await getTokenInfoForUtxo(context, utxo).catch(_ => { });
        if (!info?.amount)
            return { ...utxo, amount: 0 };
        logger_1.logger.info('Charms UTXO found: ', utxo, info);
        total += info.amount;
        return { ...utxo, amount: info.amount };
    })).filter(t => t.amount > 0);
    return charmsUtxos;
}
