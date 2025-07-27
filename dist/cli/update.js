"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareKeypairs = prepareKeypairs;
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const log_1 = require("../core/log");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const create_update_nft_spell_1 = require("../api/create-update-nft-spell");
const taproot_1 = require("../core/taproot");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const spell_operations_1 = require("../api/spell-operations");
const json_1 = require("../core/json");
function prepareKeypairs(privateKeys) {
    return privateKeys.map(priv => ({
        publicKey: (0, generate_random_keypairs_1.publicFromPrivate)(Buffer.from(priv.trim().replace('0x', ''), 'hex')),
        privateKey: Buffer.from(priv.trim().replace('0x', ''), 'hex'),
    }));
}
async function main() {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    (0, log_1.setupLog)();
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {},
        boolean: ['transmit', 'mock-proof'],
        default: {
            network: 'regtest',
            feerate: 0.00002,
            transmit: true,
            'mock-proof': false,
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
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
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
    if (!argv['feerate']) {
        console.error('--feerate is required: ', argv);
        return;
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const spell = await (0, create_update_nft_spell_1.createUpdateNftSpell)(context, feerate, previousNftTxid, {
        publicKeys: newPublicKeys,
        threshold: newThreshold,
    }, fundingUtxo);
    console.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    const previousGrailState = await (0, spell_operations_1.getPreviousGrailState)(context, previousNftTxid);
    const signatureRequest = {
        transactionBytes: spell.spellTxBytes,
        previousTransactions: await (0, spell_operations_1.getPreviousTransactions)(context, spell.spellTxBytes, spell.commitmentTxBytes),
        inputs: [
            {
                index: 0,
                state: previousGrailState,
                script: (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network).script,
            },
        ],
    };
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
    main().catch(error => {
        console.error('Error during NFT update:', error);
    });
}
