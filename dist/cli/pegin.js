"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMELOCK_BLOCKS = void 0;
exports.peginCli = peginCli;
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const log_1 = require("../core/log");
const json_1 = require("../core/json");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const create_pegin_spell_1 = require("../api/create-pegin-spell");
const spell_operations_1 = require("../api/spell-operations");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
exports.TIMELOCK_BLOCKS = 100; // Default timelock for user payments
async function peginCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    (0, log_1.setupLog)();
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        string: ['new-public-keys', 'private-keys'],
        boolean: ['transmit', 'mock-proof'],
        default: {
            network: 'regtest',
            feerate: 0.00002,
            transmit: true,
            'mock-proof': false,
            'user-payment-vout': 0,
        },
        '--': true,
    });
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();
    const appId = argv['app-id'];
    if (!appId) {
        throw new Error('--app-id is required');
    }
    const appVk = argv['app-vk'];
    const network = argv['network'];
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network,
        mockProof: argv['mock-proof'],
        ticker: 'GRAIL-NFT',
    });
    if (!argv['new-public-keys']) {
        throw new Error('--new-public-keys is required');
    }
    const newPublicKeys = argv['new-public-keys']
        .split(',')
        .map(pk => pk.trim().replace('0x', ''));
    const newThreshold = Number.parseInt(argv['new-threshold']);
    if (isNaN(newThreshold) ||
        newThreshold < 1 ||
        newThreshold > newPublicKeys.length) {
        throw new Error('Invalid new threshold. It must be a number between 1 and the number of public keys.');
    }
    const previousNftTxid = argv['previous-nft-txid'];
    if (!previousNftTxid) {
        throw new Error('--previous-nft-txid is required');
    }
    const transmit = !!argv['transmit'];
    if (!argv['private-keys']) {
        throw new Error('--private-keys is required');
    }
    const privateKeys = argv['private-keys']
        .split(',')
        .map(s => s.trim().replace('0x', ''));
    if (!argv['recovery-public-key']) {
        throw new Error('--recovery-public-key is required');
    }
    const recoveryPublicKey = argv['recovery-public-key'].replace('0x', '');
    const newGrailState = {
        publicKeys: newPublicKeys,
        threshold: newThreshold,
    };
    const userPaymentTxid = argv['user-payment-txid'];
    if (!userPaymentTxid) {
        throw new Error('--user-payment-txid is required');
    }
    const userPaymentVout = await (0, spell_operations_1.findUserPaymentVout)(context, newGrailState, userPaymentTxid, recoveryPublicKey, exports.TIMELOCK_BLOCKS);
    const userWalletAddress = await (0, spell_operations_1.getUserWalletAddressFromUserPaymentUtxo)(context, { txid: userPaymentTxid, vout: userPaymentVout }, network);
    const userPaymentDetails = {
        txid: userPaymentTxid,
        vout: userPaymentVout,
        recoveryPublicKey,
        timelockBlocks: exports.TIMELOCK_BLOCKS,
        grailState: newGrailState,
        userWalletAddress,
    };
    if (!argv['feerate']) {
        throw new Error('--feerate is required');
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const { spell, signatureRequest } = await (0, create_pegin_spell_1.createPeginSpell)(context, feerate, previousNftTxid, newGrailState, userPaymentDetails, fundingUtxo);
    console.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    const fromCosigners = privateKeys
        .map(pk => Buffer.from(pk, 'hex'))
        .map(privateKey => {
        const keypair = (0, generate_random_keypairs_1.privateToKeypair)(privateKey);
        const signatures = (0, spell_operations_1.signAsCosigner)(context, signatureRequest, keypair);
        return { publicKey: keypair.publicKey.toString('hex'), signatures };
    });
    const signedSpell = await (0, spell_operations_1.injectSignaturesIntoSpell)(context, spell, signatureRequest, fromCosigners);
    console.log('Signed spell:', JSON.stringify(signedSpell, json_1.bufferReplacer, '\t'));
    if (transmit) {
        return await (0, spell_operations_1.transmitSpell)(context, signedSpell);
    }
    return ['', ''];
}
if (require.main === module) {
    peginCli(process.argv.slice(2)).catch(err => {
        console.error(err);
    }).then;
}
