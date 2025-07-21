"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const log_1 = require("../core/log");
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    (0, log_1.setupLog)();
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {},
        default: {
            network: 'regtest',
            amount: 666666,
        },
        '--': true,
    });
    const network = argv['network'];
    const currentPublicKeys = argv['current-public-keys']
        .split(',')
        .map(pk => pk.trim());
    const currentThreshold = Number.parseInt(argv['current-threshold']);
    const amount = Number.parseInt(argv['amount']);
    const bitcoinClient = await bitcoin_1.BitcoinClient.create();
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)({ publicKeys: currentPublicKeys, threshold: currentThreshold }, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: 100,
    }, network);
    const context = await context_1.Context.create({
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: argv['mock-proof'],
        ticker: 'GRAIL-NFT',
    });
    console.log('Sending funds to user payment address:', userPaymentAddress);
    const txid = await bitcoinClient.fundAddress(userPaymentAddress, amount);
    console.log('Funds sent successfully, txid: ', txid);
    console.log('Recovery public key:', recoveryKeypair.publicKey.toString('hex'));
}
if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT update:', error);
    });
}
