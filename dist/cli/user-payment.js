"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserPaymentCharms = sendUserPaymentCharms;
exports.sendUserPaymentBtc = sendUserPaymentBtc;
exports.userPaymentCli = userPaymentCli;
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const pegin_1 = require("./pegin");
const spells_1 = require("../core/spells");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const consts_1 = require("./consts");
async function sendUserPaymentCharms(context, currentPublicKeys, currentThreshold, amount, network) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)({ publicKeys: currentPublicKeys, threshold: currentThreshold }, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: pegin_1.TIMELOCK_BLOCKS,
    }, network);
    const charmsUtxos = await (0, spells_1.findCharmsUtxos)(context, amount);
    if (charmsUtxos.length === 0) {
        throw new Error('No sufficient Charms UTXOs found for user payment.');
    }
    console.log('Sending funds to user payment address:', userPaymentAddress);
    const txid = await bitcoinClient.fundAddress(userPaymentAddress, amount);
    console.log('Funds sent successfully, txid: ', txid);
    console.log('Recovery public key:', recoveryKeypair.publicKey.toString('hex'));
    return { txid, recoveryPublicKey: recoveryKeypair.publicKey.toString('hex') };
}
async function sendUserPaymentBtc(currentPublicKeys, currentThreshold, amount, network) {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)({ publicKeys: currentPublicKeys, threshold: currentThreshold }, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: pegin_1.TIMELOCK_BLOCKS,
    }, network);
    console.log('Sending funds to user payment address:', userPaymentAddress);
    const txid = await bitcoinClient.fundAddress(userPaymentAddress, amount);
    console.log('Funds sent successfully, txid: ', txid);
    console.log('Recovery public key:', recoveryKeypair.publicKey.toString('hex'));
    return { txid, recoveryPublicKey: recoveryKeypair.publicKey.toString('hex') };
}
async function userPaymentCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        boolean: ['mock-proof'],
        default: {
            network: 'regtest',
            'mock-proof': false,
        },
        '--': true,
    });
    const network = argv['network'];
    if (!argv['current-public-keys']) {
        throw new Error('--current-public-keys is required.');
    }
    const currentPublicKeys = argv['current-public-keys']
        .split(',')
        .map(pk => pk.trim());
    const currentThreshold = Number.parseInt(argv['current-threshold']);
    if (isNaN(currentThreshold) ||
        currentThreshold < 1 ||
        currentThreshold > currentPublicKeys.length) {
        throw new Error('--current-threshold must be a number between 1 and the number of current public keys.');
    }
    const amount = Number.parseInt(argv['amount']);
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('--amount must be a positive number.');
    }
    const type = argv['type'];
    if (type && type !== 'charms' && type !== 'btc') {
        throw new Error('--type must be either "charms" or "btc".');
    }
    if (type == 'charms') {
        const context = await context_1.Context.create({
            charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
            zkAppBin: consts_1.ZKAPP_BIN,
            network,
            mockProof: !!argv['mock-proof'],
            ticker: 'GRAIL-NFT',
        });
        return await sendUserPaymentCharms(context, currentPublicKeys, currentThreshold, amount, network);
    }
    else {
        return await sendUserPaymentBtc(currentPublicKeys, currentThreshold, amount, network);
    }
}
if (require.main === module) {
    userPaymentCli(process.argv.slice(2))
        .catch(error => {
        console.error('Error during NFT update:', error);
    })
        .then(result => {
        if (result) {
            console.log('User payment created successfully:', result);
        }
        else {
            console.error('User payment creation failed.');
        }
        process.exit(result ? 0 : 1);
    });
}
