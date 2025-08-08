"use strict";
/* eslint-disable @typescript-eslint/no-empty-object-type */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalizeInfoBlank = void 0;
exports.utxoFromUtxoId = utxoFromUtxoId;
function utxoFromUtxoId(str) {
    const parts = str.split(':');
    if (parts.length !== 2) {
        throw new Error(`Invalid UTXO ID format: ${str}`);
    }
    return {
        txid: parts[0],
        vout: parseInt(parts[1], 10),
    };
}
exports.generalizeInfoBlank = {
    incomingUserBtc: [],
    incomingGrailBtc: [],
    incomingUserCharms: [],
    outgoingUserBtc: [],
    outgoingUserCharms: [],
};
