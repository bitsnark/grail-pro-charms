"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCKED_BTC_MIN_AMOUNT = exports.DEFAULT_FEERATE = exports.ZKAPP_BIN = exports.TICKER = exports.TIMELOCK_BLOCKS = void 0;
exports.TIMELOCK_BLOCKS = 100; // Number of blocks to wait before a user payment can be returned to the user
exports.TICKER = 'GRAIL-NFT'; // Ticker for the NFT
exports.ZKAPP_BIN = './zkapp/target/charms-app'; // Path to the compiled zkApp binary
exports.DEFAULT_FEERATE = 0.00002; // Default fee rate in BTC per byte
exports.LOCKED_BTC_MIN_AMOUNT = 1001; // Minimum amount of locked BTC in satoshis
