"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showWalletCharmsCli = showWalletCharmsCli;
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const json_1 = require("../core/json");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const consts_1 = require("./consts");
const spells_1 = require("../core/spells");
async function showWalletCharmsCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        boolean: ['mock-proof'],
        default: {
            network: 'regtest',
            amount: 666666,
            'mock-proof': false,
        },
        '--': true,
    });
    const network = argv['network'];
    const appId = argv['app-id'];
    if (!appId) {
        throw new Error('--app-id is required');
    }
    const appVk = argv['app-vk'];
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: consts_1.ZKAPP_BIN,
        network: network,
        mockProof: !!argv['mock-proof'],
        ticker: consts_1.TICKER,
    });
    const utxos = await (0, spells_1.findCharmsUtxos)(context);
    console.log('Found Charms UTXOs:', JSON.stringify(utxos, json_1.bufferReplacer, 2));
    return utxos;
}
if (require.main === module) {
    showWalletCharmsCli(process.argv.slice(2))
        .catch(error => {
        console.error('Error during NFT update:', error);
    })
        .then(result => process.exit(result ? 0 : 1));
}
