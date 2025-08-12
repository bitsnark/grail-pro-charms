"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualizeCli = visualizeCli;
const minimist_1 = __importDefault(require("minimist"));
const node_fs_1 = __importDefault(require("node:fs"));
const logger_1 = require("../core/logger");
const dotenv_1 = __importDefault(require("dotenv"));
const consts_1 = require("./consts");
const dot_1 = require("../visualize/dot");
const child_process_1 = require("child_process");
const crawl_1 = require("../visualize/crawl");
const utils_1 = require("./utils");
async function visualizeCli(_argv) {
    dotenv_1.default.config({ path: ['.env.test', '.env.local', '.env'] });
    const argv = (0, minimist_1.default)(_argv, {
        alias: {},
        boolean: ['mock-proof', 'skip-proof'],
        default: {
            'app-id': '38237bc376ecd951371525b2e8d866812b13eac0690a9102be9383dfc1d21d5e',
            'app-vk': 'ecd9cf39a2115c72344b2842e944756dcfd8ea31c10ead2f58bc7f2f8afd2560',
            txid: 'ab3ed21aba3f039f327540217408e6495c07a353933ee696bb6a7b49a7d7cd64',
            outfile: 'visualize.dot',
            network: 'regtest',
            feerate: consts_1.DEFAULT_FEERATE,
            transmit: true,
            'mock-proof': false,
            'skip-proof': false,
            'max-depth': 10,
        },
        '--': true,
    });
    const context = await (0, utils_1.createContext)(argv);
    const txid = argv['txid'];
    if (!txid) {
        logger_1.logger.error('--txid is required');
        return;
    }
    const outfile = argv['outfile'];
    if (!outfile) {
        logger_1.logger.error('--outfile is required');
        return;
    }
    const maxDepth = parseInt(argv['max-depth'], 10);
    if (isNaN(maxDepth) || maxDepth < 1) {
        logger_1.logger.error('--max-depth must be a positive integer');
        return;
    }
    const transactionInfoMap = await (0, crawl_1.crawlBack)(context, maxDepth, txid);
    await (0, crawl_1.crawlForward)(context, maxDepth, txid, transactionInfoMap);
    const dotFile = outfile.replace('.svg', '') + '.dot';
    // Open a write stream to the output file
    const fileWriter = node_fs_1.default.createWriteStream(dotFile, { flags: 'w' });
    const out = { log: (s) => fileWriter.write(s + '\n') };
    await (0, dot_1.dot)(context, txid, transactionInfoMap, out);
    fileWriter.close();
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`dot -Tsvg ${dotFile} -o ${outfile}`, (error, stdout, stderr) => {
            if (error) {
                logger_1.logger.error(`Error generating SVG: ${error.message}`);
                reject(error);
            }
            if (stderr)
                logger_1.logger.warn(stderr);
            logger_1.logger.debug(stdout);
            resolve();
        });
    });
}
if (require.main === module) {
    visualizeCli(process.argv.slice(2)).catch(error => {
        logger_1.logger.error(error);
    });
}
