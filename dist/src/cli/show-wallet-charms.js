"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showWalletCharmsCli = showWalletCharmsCli;
const logger_1 = require("../core/logger");
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const spells_1 = require("../core/spells");
const utils_1 = require("./utils");
async function showWalletCharmsCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        boolean: ['mock-proof', 'skip-proof'],
        default: {
            network: 'regtest',
            amount: 666666,
            'mock-proof': false,
            'skip-proof': false,
        },
        '--': true,
    });
    const context = await (0, utils_1.createContext)(argv);
    const utxos = await (0, spells_1.findCharmsUtxos)(context, Number.MAX_VALUE);
    logger_1.logger.debug('Found Charms UTXOs: ', utxos);
    return utxos;
}
if (require.main === module) {
    showWalletCharmsCli(process.argv.slice(2))
        .then(result => process.exit(result ? 0 : 2))
        .catch(error => {
        logger_1.logger.error(error);
        process.exit(1);
    });
}
