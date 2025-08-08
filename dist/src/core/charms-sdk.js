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
exports.getVerificationKey = getVerificationKey;
exports.executeSpell = executeSpell;
exports.showSpell = showSpell;
const logger_1 = require("./logger");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const child_process_1 = require("child_process");
const env_parser_1 = require("./env-parser");
function executeCommand(context, command, pwd) {
    return new Promise((resolve, reject) => {
        logger_1.logger.info(`Executing command: ${command.join(' ')}`);
        (0, child_process_1.exec)([
            pwd ? `cd ${pwd}` : '',
            'export RUST_BACKTRACE=full',
            `export USE_MOCK_PROOF=${context.mockProof ? 'true' : 'false'}`,
            `export SKIP_PROOF=${context.skipProof ? 'true' : 'false'}`,
            command.filter(Boolean).join(' '),
        ]
            .filter(Boolean)
            .join(' && '), (error, stdout, stderr) => {
            if (error) {
                logger_1.logger.error(`Execution error: ${error.message}`);
                reject(error);
            }
            if (stderr) {
                logger_1.logger.warn(`Stderr: ${stderr}`);
            }
            if (stdout)
                logger_1.logger.debug(stdout);
            resolve(stdout);
        });
    }).catch((error) => {
        logger_1.logger.error('Execution error: ', error);
        throw error;
    });
}
async function getVerificationKey(context) {
    const command = [context.charmsBin, 'app vk'];
    const zkappFolder = env_parser_1.parse.string('ZKAPP_FOLDER', './zkapp');
    return (await executeCommand(context, command, zkappFolder)).trim();
}
async function executeSpell(context, fundingUtxo, feerate, changeAddress, yamlStr, previousTransactions = []) {
    const tempDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'charms-'));
    const tempFile = node_path_1.default.join(tempDir, 'spell.yaml');
    node_fs_1.default.writeFileSync(tempFile, yamlStr, 'utf8');
    const command = [
        context.charmsBin,
        'spell prove',
        `--spell ${tempFile}`,
        `--fee-rate ${Math.round(feerate * 1e8)}`, // Convert to satoshis
        `--app-bins ${context.zkAppBin}`,
        `--funding-utxo ${fundingUtxo.txid}:${fundingUtxo.vout}`,
        `--funding-utxo-value ${fundingUtxo.value}`,
        `--change-address ${changeAddress}`,
        previousTransactions?.length
            ? `--prev-txs ${previousTransactions.map(tx => tx.toString('hex')).join(',')}`
            : undefined,
        context.temporarySecret
            ? `--temporary-secret-str ${context.temporarySecret.toString('hex')}`
            : undefined,
    ].filter(Boolean);
    return await executeCommand(context, command).then(result => {
        // Result could have some irrelevant garbage?
        const resultLines = result
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);
        const obj = JSON.parse(resultLines.pop() ?? '');
        if (!Array.isArray(obj)) {
            throw new Error('Spell execution did not return an array');
        }
        const a = obj.map((item) => Buffer.from(item, 'hex'));
        if (a.length !== 2) {
            throw new Error('Spell execution did not return exactly two transactions');
        }
        return {
            commitmentTxBytes: a[0],
            spellTxBytes: a[1],
        };
    });
}
async function showSpell(context, txid) {
    const txhex = await context.bitcoinClient.getTransactionHex(txid);
    const command = [context.charmsBin, 'tx show-spell', `--tx ${txhex}`].filter(Boolean);
    const stdout = await executeCommand(context, command);
    return yaml.load(stdout);
}
