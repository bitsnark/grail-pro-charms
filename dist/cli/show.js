"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const charms_sdk_1 = require("../core/charms-sdk");
const log_1 = require("../core/log");
const env_parser_1 = require("../core/env-parser");
const context_1 = require("../core/context");
async function viewNft(context, nftTxid) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const txhex = await bitcoinClient.getTransactionHex(nftTxid);
    if (!txhex) {
        console.error(`Transaction ${nftTxid} not found`);
        return;
    }
    const spell = await (0, charms_sdk_1.showSpell)(context, txhex);
    console.log('spell: ' + JSON.stringify(spell, null, '\t'));
}
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    (0, log_1.setupLog)();
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {},
        default: {
            'nft-txid': '509697aaa6bc0807dc00ebd8600d38c4879c66d8d79e426023861ba1a0e76769',
        },
    });
    const nftTxid = argv['nft-txid'];
    if (!nftTxid) {
        console.error('Please provide the NFT transaction ID using --nft-txid');
        process.exit(1);
    }
    const context = await context_1.Context.create({
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: argv['mock-proof'],
        ticker: 'GRAIL-NFT',
    });
    await viewNft(context, nftTxid).catch(error => {
        console.error('Error viewing NFT:', error);
    });
}
if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT view:', error);
    });
}
