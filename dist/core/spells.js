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
exports.txidToHash = txidToHash;
exports.hashToTxid = hashToTxid;
exports.txBytesToTxid = txBytesToTxid;
exports.txHexToTxid = txHexToTxid;
exports.getStateFromNft = getStateFromNft;
exports.signTransactionInput = signTransactionInput;
exports.resignSpellWithTemporarySecret = resignSpellWithTemporarySecret;
exports.createSpell = createSpell;
const bitcoin = __importStar(require("bitcoinjs-lib"));
const yaml = __importStar(require("js-yaml"));
const secp256k1_1 = require("@noble/curves/secp256k1");
const charms_sdk_1 = require("./charms-sdk");
const json_1 = require("./json");
const taproot_common_1 = require("./taproot/taproot-common");
const charms_sdk_2 = require("./charms-sdk");
// SIGHASH type for Taproot (BIP-342)
const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;
function txidToHash(txid) {
    return Buffer.from(txid, 'hex').reverse();
}
function hashToTxid(hash) {
    // This is a hack to avoid Buffer.reverse() which behaves unexpectedly
    return Buffer.from(Array.from(hash).reverse()).toString('hex');
}
function txBytesToTxid(txBytes) {
    return bitcoin.Transaction.fromBuffer(txBytes).getId();
}
function txHexToTxid(txHex) {
    const txBytes = Buffer.from(txHex, 'hex');
    return txBytesToTxid(txBytes);
}
async function getStateFromNft(context, nftTxId) {
    const previousNftTxhex = await context.bitcoinClient.getTransactionHex(nftTxId);
    if (!previousNftTxhex) {
        throw new Error(`Previous NFT transaction ${nftTxId} not found`);
    }
    const previousSpellData = await (0, charms_sdk_2.showSpell)(context, previousNftTxhex);
    console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
    const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
    const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;
    return {
        publicKeys: previousPublicKeys,
        threshold: previousThreshold,
    };
}
function signTransactionInput(context, txBytes, inputIndex, script, previousTxBytesMap, keypair) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(txBytes);
    // Tapleaf version for tapscript is always 0xc0
    // BitcoinJS v6+ exposes tapleafHash for this calculation
    const tapleafHash = (0, taproot_common_1.getHash)(script);
    const previous = [];
    for (const input of tx.ins) {
        let ttxBytes;
        const inputTxid = hashToTxid(input.hash);
        if (previousTxBytesMap[inputTxid]) {
            ttxBytes = previousTxBytesMap[inputTxid];
        }
        else
            throw new Error(`Input transaction ${inputTxid} not found`);
        const ttx = bitcoin.Transaction.fromBuffer(ttxBytes);
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
async function resignSpellWithTemporarySecret(context, spellTxBytes, previousTxBytesMap, temporarySecret) {
    // Load the transaction to sign
    const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
    const inputIndex = tx.ins.length - 1; // Last input is the commitment
    const previous = [];
    for (const input of tx.ins) {
        let ttxBytes;
        const inputTxid = hashToTxid(input.hash);
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
    console.log('Creating spell...');
    const previousTransactions = await Promise.all(previousTxids.map(async (txid) => context.bitcoinClient.getTransactionHex(txid)));
    const yamlStr = yaml.dump(request.toYamlObj()); // toYaml(request.toYamlObj());
    const output = await (0, charms_sdk_1.executeSpell)(context, request.fundingUtxo, request.fundingChangeAddress, yamlStr, previousTransactions.map(tx => Buffer.from(tx, 'hex')));
    console.log('Spell created successfully:', JSON.stringify(output, json_1.bufferReplacer, '\t'));
    return {
        commitmentTxBytes: output.commitmentTxBytes,
        spellTxBytes: output.spellTxBytes,
    };
}
