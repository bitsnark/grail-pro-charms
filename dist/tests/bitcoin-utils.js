"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBlocks = generateBlocks;
const logger_1 = require("../src/core/logger");
const node_child_process_1 = require("node:child_process");
async function generateBlocks(count = 1) {
    const network = 'regtest';
    const username = process.env.BTC_NODE_USERNAME || 'bitcoin';
    const password = process.env.BTC_NODE_PASSWORD || '1234';
    const bitcoinCliPath = process.env.BITCOIN_CLI_PATH || 'bitcoin-cli';
    const command = `${bitcoinCliPath} -${network} -rpcuser=${username} -rpcpassword=${password} -generate ${count}`;
    await (0, node_child_process_1.exec)(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error generating blocks: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error output: ${stderr}`);
            return;
        }
        logger_1.logger.log(`Blocks generated: ${stdout}`);
    });
}
