"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pegoutCli = pegoutCli;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const spell_operations_1 = require("../api/spell-operations");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const create_pegout_spell_1 = require("../api/create-pegout-spell");
const pegin_1 = require("./pegin");
const consts_1 = require("./consts");
async function pegoutCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        string: ['new-public-keys', 'private-keys'],
        boolean: ['transmit', 'mock-proof', 'skip-proof'],
        default: {
            network: 'regtest',
            feerate: consts_1.DEFAULT_FEERATE,
            transmit: true,
            'mock-proof': false,
            'skip-proof': false,
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
    if (appVk === undefined) {
        throw new Error('--app-vk is required');
    }
    const network = argv['network'];
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: !!argv['mock-proof'],
        skipProof: !!argv['skip-proof'],
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
    if (!argv['user-payment-txid']) {
        throw new Error('--user-payment-txid is required');
    }
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
    const userPaymentVout = await (0, spell_operations_1.findUserPaymentVout)(context, newGrailState, userPaymentTxid, recoveryPublicKey, pegin_1.TIMELOCK_BLOCKS);
    const userWalletAddress = await (0, spell_operations_1.getUserWalletAddressFromUserPaymentUtxo)(context, { txid: userPaymentTxid, vout: userPaymentVout }, network);
    const userPaymentDetails = {
        txid: userPaymentTxid,
        vout: userPaymentVout,
        recoveryPublicKey,
        timelockBlocks: pegin_1.TIMELOCK_BLOCKS,
        grailState: newGrailState,
        userWalletAddress,
    };
    const feerate = Number.parseFloat(argv['feerate']);
    const { spell, signatureRequest } = await (0, create_pegout_spell_1.createPegoutSpell)(context, feerate, previousNftTxid, newGrailState, userPaymentDetails, fundingUtxo);
    logger_1.logger.debug('Spell created: ', spell);
    logger_1.logger.debug('Signature request: ', signatureRequest);
    const fromCosigners = privateKeys
        .map(pk => Buffer.from(pk, 'hex'))
        .map(privateKey => {
        const keypair = (0, generate_random_keypairs_1.privateToKeypair)(privateKey);
        const signatures = (0, spell_operations_1.signAsCosigner)(context, signatureRequest, keypair);
        return { publicKey: keypair.publicKey.toString('hex'), signatures };
    });
    logger_1.logger.debug('Signature responses from cosigners: ', fromCosigners);
    const filteredSignatures = fromCosigners.map(response => ({
        ...response,
        signatures: (0, spell_operations_1.filterValidCosignerSignatures)(context, signatureRequest, response.signatures, Buffer.from(response.publicKey, 'hex')),
    }));
    logger_1.logger.debug('Signature responses from cosigners after fiultering: ', filteredSignatures);
    const signedSpell = await (0, spell_operations_1.injectSignaturesIntoSpell)(context, spell, signatureRequest, filteredSignatures);
    logger_1.logger.debug('Signed spell: ', signedSpell);
    if (transmit) {
        return await (0, spell_operations_1.transmitSpell)(context, signedSpell);
    }
    return ['', ''];
}
if (require.main === module) {
    pegoutCli(process.argv.slice(2)).catch(err => {
        logger_1.logger.error(err);
    });
}
