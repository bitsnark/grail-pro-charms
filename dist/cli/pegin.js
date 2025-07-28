"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMELOCK_BLOCKS = void 0;
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
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    (0, log_1.setupLog)();
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
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
        console.error('--app-id is required');
        return;
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
        console.error('--new-public-keys is required');
        return;
    }
    const newPublicKeys = argv['new-public-keys']
        .split(',')
        .map(pk => pk.trim().replace('0x', ''));
    const newThreshold = Number.parseInt(argv['new-threshold']);
    if (isNaN(newThreshold) ||
        newThreshold < 1 ||
        newThreshold > newPublicKeys.length) {
        console.error('Invalid new threshold. It must be a number between 1 and the number of public keys.');
        return;
    }
    const previousNftTxid = argv['previous-nft-txid'];
    if (!previousNftTxid) {
        console.error('--previous-nft-txid is required');
        return;
    }
    const transmit = !!argv['transmit'];
    if (!argv['private-keys']) {
        console.error('--private-keys is required');
        return;
    }
    const privateKeys = argv['private-keys']
        .split(',')
        .map(s => s.trim().replace('0x', ''));
    if (!argv['recovery-public-key']) {
        console.error('--recovery-public-key is required');
        return;
    }
    const recoveryPublicKey = argv['recovery-public-key'].replace('0x', '');
    const newGrailState = {
        publicKeys: newPublicKeys,
        threshold: newThreshold,
    };
    const userPaymentTxid = argv['user-payment-txid'];
    if (!userPaymentTxid) {
        console.error('--user-payment-txid is required');
        return;
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
        console.error('--feerate is required');
        return;
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
        await (0, spell_operations_1.transmitSpell)(context, signedSpell);
    }
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
    });
}
