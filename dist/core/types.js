"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
