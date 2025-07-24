"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const log_1 = require("../core/log");
const json_1 = require("../core/json");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const create_pegin_spell_1 = require("../api/create-pegin-spell");
const spell_operations_1 = require("../api/spell-operations");
const taproot_1 = require("../core/taproot");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
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
    if (!argv['user-payment-txid']) {
        console.error('--user-payment-txid is required');
        return;
    }
    if (!argv['recovery-public-key']) {
        console.error('--recovery-public-key is required');
        return;
    }
    const recoveryPublicKey = argv['recovery-public-key'].replace('0x', '');
    const newGrailState = {
        publicKeys: newPublicKeys,
        threshold: newThreshold,
    };
    const userPaymentDetails = {
        txid: argv['user-payment-txid'],
        vout: Number.parseInt(argv['user-payment-vout']) || 0,
        recoveryPublicKey,
        timelockBlocks: 100,
    };
    let userPaymentVout = 0;
    if (!argv['user-payment-vout']) {
        console.warn('--user-payment-vout not provided, auto detecting...');
        userPaymentVout = await (0, spell_operations_1.findUserPaymentVout)(context, newGrailState, userPaymentDetails);
        userPaymentDetails.vout = userPaymentVout;
        console.warn(`Detected user payment vout: ${userPaymentVout}`);
    }
    let userWalletAddress = argv['user-wallet-address'];
    if (!userWalletAddress) {
        userWalletAddress = await bitcoinClient.getAddress();
    }
    if (!argv['feerate']) {
        console.error('--feerate is required');
        return;
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const spell = await (0, create_pegin_spell_1.createPeginSpell)(context, feerate, previousNftTxid, newGrailState, userPaymentDetails, userWalletAddress, fundingUtxo);
    console.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    const previousGrailState = await (0, spell_operations_1.getPreviousGrailState)(context, previousNftTxid);
    const signatureRequest = {
        transactionBytes: spell.spellTxBytes,
        previousTransactions: await (0, spell_operations_1.getPreviousTransactions)(context, spell),
        inputs: [
            {
                index: 0,
                state: previousGrailState,
                script: (0, taproot_1.generateSpendingScriptForGrail)(previousGrailState, context.network).script,
            },
            {
                index: 1,
                state: newGrailState,
                script: (0, taproot_1.generateSpendingScriptsForUserPayment)(newGrailState, userPaymentDetails, context.network).grail.script,
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
    main().catch(err => {
        console.error(err);
    });
}
