"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferCli = transferCli;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const bitcoin_1 = require("../core/bitcoin");
const spell_operations_1 = require("../api/spell-operations");
const consts_1 = require("./consts");
const create_transfer_spell_1 = require("../api/create-transfer-spell");
const spells_1 = require("../core/spells");
const utils_1 = require("./utils");
async function transferCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
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
    const context = await (0, utils_1.createContext)(argv);
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
    logger_1.logger.debug('Found Charms UTXOs: ', inputUtxos);
    const outputAddress = argv['output-address'] ?? (await bitcoinClient.getAddress());
    logger_1.logger.debug('Output address: ', outputAddress);
    const changeAddress = argv['change-address'] ?? (await bitcoinClient.getAddress());
    logger_1.logger.debug('Change address: ', changeAddress);
    const spell = await (0, create_transfer_spell_1.createTransferSpell)(context, feerate, inputUtxos, outputAddress, changeAddress, amount, fundingUtxo);
    logger_1.logger.debug('Spell created: ', spell);
    const previousTransactionsMap = await (0, spell_operations_1.getPreviousTransactions)(context, spell.spellTxBytes, spell.commitmentTxBytes);
    spell.spellTxBytes = await bitcoinClient.signTransaction(spell.spellTxBytes, previousTransactionsMap, 'ALL|ANYONECANPAY');
    logger_1.logger.debug('Signed spell transaction bytes: ', spell.spellTxBytes.toString('hex'));
    if (transmit) {
        const transmittedTxids = await (0, spell_operations_1.transmitSpell)(context, spell);
        return transmittedTxids;
    }
    return ['', ''];
}
if (require.main === module) {
    transferCli(process.argv.slice(2)).catch(error => {
        logger_1.logger.error(error);
    });
}
