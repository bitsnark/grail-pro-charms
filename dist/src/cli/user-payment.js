"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserPaymentCharms = sendUserPaymentCharms;
exports.sendUserPaymentBtc = sendUserPaymentBtc;
exports.userPaymentCli = userPaymentCli;
const logger_1 = require("../core/logger");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const taproot_1 = require("../core/taproot");
const generate_random_keypairs_1 = require("./generate-random-keypairs");
const pegin_1 = require("./pegin");
const spells_1 = require("../core/spells");
const consts_1 = require("./consts");
const create_transfer_spell_1 = require("../api/create-transfer-spell");
const spell_operations_1 = require("../api/spell-operations");
const bitcoin_1 = require("../core/bitcoin");
const utils_1 = require("./utils");
async function sendUserPaymentCharms(context, feerate, grailState, amount, changeAddress, network) {
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)(grailState, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: pegin_1.TIMELOCK_BLOCKS,
    }, network);
    const charmsUtxos = await (0, spells_1.findCharmsUtxos)(context, amount);
    if (charmsUtxos.length === 0) {
        throw new Error('No sufficient Charms UTXOs found for user payment.');
    }
    logger_1.logger.debug('Found Charms UTXOs: ', charmsUtxos);
    logger_1.logger.debug('Sending charms to user payment address: ', userPaymentAddress);
    const spell = await (0, create_transfer_spell_1.createTransferSpell)(context, feerate, charmsUtxos, userPaymentAddress, changeAddress, amount);
    const tx = bitcoin.Transaction.fromHex(spell.spellTxBytes.toString('hex'));
    const prevTxids = tx.ins.map(input => (0, bitcoin_1.hashToTxid)(input.hash));
    console.log('Previous transaction IDs: ', prevTxids);
    const previousTransactions = await (0, spell_operations_1.getPreviousTransactions)(context, spell.spellTxBytes, spell.commitmentTxBytes);
    console.log('Previous transactions: ', previousTransactions);
    spell.spellTxBytes = await context.bitcoinClient.signTransaction(spell.spellTxBytes, previousTransactions);
    const [_, spellTxid] = await (0, spell_operations_1.transmitSpell)(context, spell);
    return {
        txid: spellTxid,
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
    };
}
async function sendUserPaymentBtc(context, grailState, amount) {
    const recoveryKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
    const userPaymentAddress = (0, taproot_1.generateUserPaymentAddress)(grailState, {
        recoveryPublicKey: recoveryKeypair.publicKey.toString('hex'),
        timelockBlocks: pegin_1.TIMELOCK_BLOCKS,
    }, context.network);
    logger_1.logger.debug('Sending funds to user payment address: ', userPaymentAddress);
    const txid = await context.bitcoinClient.fundAddress(userPaymentAddress, amount);
    logger_1.logger.debug('Funds sent successfully, txid: ', txid);
    logger_1.logger.debug('Recovery public key: ', recoveryKeypair.publicKey.toString('hex'));
    return { txid, recoveryPublicKey: recoveryKeypair.publicKey.toString('hex') };
}
async function userPaymentCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        boolean: ['mock-proof', 'skip-proof'],
        default: {
            network: 'regtest',
            'mock-proof': false,
            'skip-proof': false,
            feerate: consts_1.DEFAULT_FEERATE,
        },
        '--': true,
    });
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
    const grailState = {
        publicKeys: currentPublicKeys,
        threshold: currentThreshold,
    };
    const amount = Number.parseInt(argv['amount']);
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('--amount must be a positive number.');
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const type = argv['type'];
    if (type !== 'charms' && type !== 'btc') {
        throw new Error('--type must be either "charms" or "btc".');
    }
    const context = await (0, utils_1.createContext)(argv);
    if (type == 'charms') {
        const changeAddress = await context.bitcoinClient.getAddress();
        return await sendUserPaymentCharms(context, feerate, grailState, amount, changeAddress, context.network);
    }
    else if (type == 'btc') {
        return await sendUserPaymentBtc(context, grailState, amount);
    }
    else
        throw new Error('Invalid type specified. Use "charms" or "btc".');
}
if (require.main === module) {
    userPaymentCli(process.argv.slice(2))
        .then(result => {
        if (result) {
            logger_1.logger.log('User payment created successfully: ', result);
        }
        else {
            logger_1.logger.error('User payment creation failed.');
        }
        process.exit(result ? 0 : 1);
    })
        .catch(error => {
        logger_1.logger.error(error);
        process.exit(2);
    });
}
