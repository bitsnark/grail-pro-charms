"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMELOCK_BLOCKS = void 0;
exports.mintCli = mintCli;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const spell_operations_1 = require("../api/spell-operations");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const consts_1 = require("./consts");
const spell_operations_2 = require("../api/spell-operations");
const create_mint_spell_1 = require("../api/create-mint-spell");
exports.TIMELOCK_BLOCKS = 100; // Default timelock for user payments
async function mintCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        string: ['private-keys', 'user-wallet-address'],
        boolean: ['transmit', 'mock-proof', 'skip-proof'],
        default: {
            network: 'regtest',
            feerate: consts_1.DEFAULT_FEERATE,
            transmit: true,
            'mock-proof': false,
            'skip-proof': false,
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
        mockProof: !!argv['mock-proof'],
        skipProof: !!argv['skip-proof'],
        ticker: 'GRAIL-NFT',
    });
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
    const userWalletAddress = argv['user-wallet-address'] ||
        (await context.bitcoinClient.getAddress());
    if (!argv['feerate']) {
        throw new Error('--feerate is required');
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const amount = Number.parseInt(argv['amount'], 10);
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('--amount is required and must be a valid number');
    }
    const { spell, signatureRequest } = await (0, create_mint_spell_1.createMintSpell)(context, feerate, previousNftTxid, amount, userWalletAddress, fundingUtxo);
    logger_1.logger.debug('Spell created: ', spell);
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
        signatures: (0, spell_operations_2.filterValidCosignerSignatures)(context, signatureRequest, response.signatures, Buffer.from(response.publicKey, 'hex')),
    }));
    logger_1.logger.debug('Signature responses from cosigners after fiultering: ', filteredSignatures);
    const signedSpell = await (0, spell_operations_1.injectSignaturesIntoSpell)(context, spell, signatureRequest, filteredSignatures);
    logger_1.logger.debug('Signed spell: ', signedSpell);
    if (transmit) {
        const transmittedTxids = await (0, spell_operations_1.transmitSpell)(context, signedSpell);
        return transmittedTxids;
    }
    return ['', ''];
}
if (require.main === module) {
    mintCli(process.argv.slice(2)).catch(err => {
        logger_1.logger.error(err);
    });
}
