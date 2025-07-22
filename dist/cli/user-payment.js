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
const log_1 = require("../core/log");
const json_1 = require("../core/json");
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
    if (!argv['current-public-keys']) {
        console.error('--current-public-keys is required.');
        return;
    }
    const currentPublicKeys = argv['current-public-keys']
        .split(',')
        .map(pk => pk.trim());
    const currentThreshold = Number.parseInt(argv['current-threshold']);
    if (isNaN(currentThreshold) ||
        currentThreshold < 1 ||
        currentThreshold > currentPublicKeys.length) {
        console.error('--current-threshold must be a number between 1 and the number of current public keys.');
        return;
    }
    const amount = Number.parseInt(argv['amount']);
    if (!amount || isNaN(amount) || amount <= 0) {
        console.error('--amount must be a positive number.');
        return;
    }
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    console.log('Recovery keypair generated:', JSON.stringify(recoveryKeypair, json_1.bufferReplacer, 2));
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)({ publicKeys: currentPublicKeys, threshold: currentThreshold }, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: 100,
    }, network);
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
