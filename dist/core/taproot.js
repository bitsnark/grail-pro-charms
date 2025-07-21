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
exports.generateSpendingScriptForGrail = generateSpendingScriptForGrail;
exports.generateSpendingScriptsForUser = generateSpendingScriptsForUser;
exports.generateUserPaymentAddress = generateUserPaymentAddress;
exports.generateGrailPaymentAddress = generateGrailPaymentAddress;
/* eslint-disable no-console */
const bitcoin = __importStar(require("bitcoinjs-lib"));
const taptree_1 = require("./taproot/taptree");
function generateSpendingScriptForGrail(grailState, network) {
    const multisigScript = generateMultisigScript(grailState);
    const stt = new taptree_1.SimpleTapTree([multisigScript], network);
    return {
        script: multisigScript,
        controlBlock: stt.getControlBlock(0),
    };
}
function generateSpendingScriptForUserPayment(grailState) {
    return generateMultisigScript(grailState);
}
function generateMultisigScript(grailState) {
    const sortedCosigners = [...grailState.publicKeys].sort();
    const parts = sortedCosigners
        .map((cosigner, index) => [
        Buffer.from(cosigner, 'hex'),
        index === 0
            ? bitcoin.opcodes.OP_CHECKSIG
            : bitcoin.opcodes.OP_CHECKSIGADD,
    ])
        .flat();
    parts.push(bitcoin.script.number.encode(grailState.threshold));
    parts.push(bitcoin.opcodes.OP_NUMEQUAL);
    return bitcoin.script.compile(parts);
}
function generateSpendingScriptForUserRecovery(userPaymentDetails) {
    const timelockScript = bitcoin.script.compile([
        bitcoin.script.number.encode(userPaymentDetails.timelockBlocks),
        bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
        bitcoin.opcodes.OP_DROP,
        Buffer.from(userPaymentDetails.recoveryPublicKey, 'hex'),
        bitcoin.opcodes.OP_CHECKSIG,
    ]);
    return timelockScript;
}
function generateSpendingScriptsForUser(grailState, userPaymentDetails, network) {
    const grailScript = generateSpendingScriptForUserPayment(grailState);
    const recoveryScript = generateSpendingScriptForUserRecovery(userPaymentDetails);
    const stt = new taptree_1.SimpleTapTree([grailScript, recoveryScript], network);
    return {
        grail: {
            script: grailScript,
            controlBlock: stt.getControlBlock(0),
        },
        recovery: {
            script: recoveryScript,
            controlBlock: stt.getControlBlock(1),
        },
    };
}
function generateUserPaymentAddress(grailState, userPaymentDetails, network) {
    const grailScript = generateSpendingScriptForUserPayment(grailState);
    const recoveryScript = generateSpendingScriptForUserRecovery(userPaymentDetails);
    const stt = new taptree_1.SimpleTapTree([grailScript, recoveryScript], network);
    return stt.getTaprootAddress();
}
function generateGrailPaymentAddress(grailState, network) {
    const multisigScript = generateSpendingScriptForGrail(grailState, network);
    const stt = new taptree_1.SimpleTapTree([multisigScript.script], network);
    return stt.getTaprootAddress();
}
