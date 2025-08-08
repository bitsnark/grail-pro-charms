"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const charms_sdk_1 = require("../core/charms-sdk");
const env_parser_1 = require("../core/env-parser");
const context_1 = require("../core/context");
async function viewNft(context, nftTxid) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const txhex = await bitcoinClient.getTransactionHex(nftTxid);
    if (!txhex) {
        logger_1.logger.error(`Transaction ${nftTxid} not found`);
        return;
    }
    const spell = await (0, charms_sdk_1.showSpell)(context, txhex);
    logger_1.logger.debug('spell: ', spell);
}
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {},
        default: {
            'nft-txid': '509697aaa6bc0807dc00ebd8600d38c4879c66d8d79e426023861ba1a0e76769',
        },
    });
    const nftTxid = argv['nft-txid'];
    if (!nftTxid) {
        logger_1.logger.error('Please provide the NFT transaction ID using --nft-txid');
        process.exit(1);
    }
    const context = await context_1.Context.create({
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: !!argv['mock-proof'],
        skipProof: !!argv['skip-proof'],
        ticker: 'GRAIL-NFT',
    });
    await viewNft(context, nftTxid).catch(error => {
        logger_1.logger.error('Error viewing NFT: ', error);
    });
}
if (require.main === module) {
    main().catch(error => {
        logger_1.logger.error('Error during NFT view: ', error);
    });
}
