"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNewGrailStateFromArgv = getNewGrailStateFromArgv;
exports.getUserPaymentFromArgv = getUserPaymentFromArgv;
const node_fs_1 = __importDefault(require("node:fs"));
const grailStateSchema = {
    publicKeys: [''],
    threshold: 0,
};
const userPaymentDetailsSchema = {
    recoveryPublicKey: '',
    timelockBlocks: 0,
    txid: '',
    vout: 0,
    grailState: grailStateSchema,
};
function checkObj(obj, schema) {
    if (typeof obj != typeof schema)
        return false;
    if (Array.isArray(schema) && !Array.isArray(obj))
        return false;
    if (Array.isArray(schema)) {
        for (const item of obj) {
            if (!checkObj(item, schema[0]))
                return false;
        }
        return true;
    }
    if (typeof schema === 'object') {
        for (const key of Object.keys(schema)) {
            if (!obj[key])
                return false;
            if (!checkObj(obj[key], schema[key]))
                return false;
        }
    }
    return true;
}
function getNewGrailStateFromArgv(argv) {
    let newGrailState = null;
    if (!argv['new-grail-state-file']) {
        throw new Error('--new-grail-state-file is required');
    }
    const grailStateFile = argv['new-grail-state-file'];
    const fileContent = node_fs_1.default.readFileSync(grailStateFile, 'utf-8');
    newGrailState = JSON.parse(fileContent);
    if (!checkObj(newGrailState, grailStateSchema)) {
        throw new Error(`Invalid grail state format. Required format: ${JSON.stringify(grailStateSchema)}`);
    }
    return newGrailState;
}
function getUserPaymentFromArgv(argv) {
    if (!argv['user-payment-txid']) {
        throw new Error('--user-payment-txid is required');
    }
    const userPaymentFile = argv['user-payment-file'];
    const fileContent = node_fs_1.default.readFileSync(userPaymentFile, 'utf-8');
    const userPaymentDetails = JSON.parse(fileContent);
    if (!checkObj(userPaymentDetails, userPaymentDetailsSchema)) {
        throw new Error(`Invalid user payment details format. Required format: ${JSON.stringify(userPaymentDetails)}`);
    }
    return userPaymentDetails;
}
