"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const create_update_nft_spell_1 = require("../api/create-update-nft-spell");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const spell_operations_1 = require("../api/spell-operations");
const utils_1 = require("./utils");
const consts_1 = require("./consts");
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {},
        boolean: ['transmit', 'mock-proof'],
        default: {
            network: 'regtest',
            feerate: consts_1.DEFAULT_FEERATE,
            transmit: true,
            'mock-proof': false,
        },
        '--': true,
    });
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();
    const appId = argv['app-id'];
    if (!appId) {
        logger_1.logger.error('--app-id is required');
        return;
    }
    const appVk = argv['app-vk'];
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: argv['mock-proof'],
        ticker: 'GRAIL-NFT',
    });
    const previousNftTxid = argv['previous-nft-txid'];
    if (!previousNftTxid) {
        logger_1.logger.error('--previous-nft-txid is required');
        return;
    }
    const transmit = !!argv['transmit'];
    if (!argv['private-keys']) {
        logger_1.logger.error('--private-keys is required');
        return;
    }
    const privateKeys = argv['private-keys']
        .split(',')
        .map(s => s.trim().replace('0x', ''));
    if (!argv['feerate']) {
        logger_1.logger.error('--feerate is required: ', argv);
        return;
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const newGrailState = (0, utils_1.getNewGrailStateFromArgv)(argv);
    if (!newGrailState) {
        logger_1.logger.error('Invalid new grail state');
        return;
    }
    const { spell, signatureRequest } = await (0, create_update_nft_spell_1.createUpdateNftSpell)(context, feerate, previousNftTxid, newGrailState, fundingUtxo);
    logger_1.logger.debug('Spell created:', spell);
    logger_1.logger.debug('Signature request:', signatureRequest);
    const fromCosigners = privateKeys
        .map(pk => Buffer.from(pk, 'hex'))
        .map(privateKey => {
        const keypair = (0, generate_random_keypairs_1.privateToKeypair)(privateKey);
        const signatures = (0, spell_operations_1.signAsCosigner)(context, signatureRequest, keypair);
        return { publicKey: keypair.publicKey.toString('hex'), signatures };
    });
    const signedSpell = await (0, spell_operations_1.injectSignaturesIntoSpell)(context, spell, signatureRequest, fromCosigners);
    logger_1.logger.debug('Signed spell:', signedSpell);
    if (transmit) {
        await (0, spell_operations_1.transmitSpell)(context, signedSpell);
    }
}
if (require.main === module) {
    main().catch(error => {
        logger_1.logger.error('Error during NFT update:', error);
    });
}
