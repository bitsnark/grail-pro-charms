"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transmitCli = transmitCli;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const context_1 = require("../core/context");
const env_parser_1 = require("../core/env-parser");
const spell_operations_1 = require("../api/spell-operations");
const json_1 = require("../core/json");
const consts_1 = require("./consts");
const create_transmit_spell_1 = require("../api/create-transmit-spell");
const spells_1 = require("../core/spells");
async function transmitCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
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
        throw new Error('--app-id is required');
    }
    const appVk = argv['app-vk'];
    const network = argv['network'];
    const context = await context_1.Context.create({
        appId,
        appVk,
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: consts_1.ZKAPP_BIN,
        network: network,
        mockProof: argv['mock-proof'],
        ticker: consts_1.TICKER,
    });
    const transmit = !!argv['transmit'];
    const feerate = Number.parseFloat(argv['feerate']);
    if (isNaN(feerate) || feerate <= 0) {
        throw new Error('--feerate must be a positive number.');
    }
    const amount = Number.parseInt(argv['amount']);
    if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('--amount must be a positive number.');
    }
    const inputUtxos = await (0, spells_1.findCharmsUtxos)(context, amount);
    if (inputUtxos.length === 0) {
        throw new Error('No Charms UTXOs found for the specified amount.');
    }
    logger_1.logger.log('Found Charms UTXOs:', inputUtxos);
    const outputAddress = argv['output-address'] ?? (await bitcoinClient.getAddress());
    logger_1.logger.log('Output address:', outputAddress);
    const changeAddress = argv['change-address'] ?? (await bitcoinClient.getAddress());
    logger_1.logger.log('Change address:', changeAddress);
    const spell = await (0, create_transmit_spell_1.createTransmitSpell)(context, feerate, inputUtxos, outputAddress, changeAddress, amount, fundingUtxo);
    logger_1.logger.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, 2));
    const previousTransactionsMap = await (0, spell_operations_1.getPreviousTransactions)(context, spell.spellTxBytes, spell.commitmentTxBytes);
    spell.spellTxBytes = await bitcoinClient.signTransaction(spell.spellTxBytes, previousTransactionsMap, 'ALL|ANYONECANPAY');
    logger_1.logger.log('Signed spell transaction bytes:', spell.spellTxBytes.toString('hex'));
    if (transmit) {
        const transmittedTxids = await (0, spell_operations_1.transmitSpell)(context, spell);
        // if (network === 'regtest') {
        // 	await context.bitcoinClient.generateBlocks(transmittedTxids);
        // }
        return transmittedTxids;
    }
    return ['', ''];
}
if (require.main === module) {
    transmitCli(process.argv.slice(2)).catch(error => {
        logger_1.logger.error(error);
    });
}
