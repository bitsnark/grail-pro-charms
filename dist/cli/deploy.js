"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployNft = deployNft;
exports.deployNftCli = deployNftCli;
const minimist_1 = __importDefault(require("minimist"));
const logger_1 = require("../core/logger");
const dotenv_1 = __importDefault(require("dotenv"));
const context_1 = require("../core/context");
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const spells_1 = require("../core/spells");
const spell_operations_1 = require("../api/spell-operations");
const env_parser_1 = require("../core/env-parser");
const json_1 = require("../core/json");
const consts_1 = require("./consts");
async function deployNft(context, deployerPublicKey, feerate, fundingUtxo, transmit = false) {
    const initialNftState = {
        publicKeys: [deployerPublicKey.toString('hex')],
        threshold: 1,
    };
    const grailAddress = (0, taproot_1.generateGrailPaymentAddress)(initialNftState, context.network);
    const fundingChangeAddress = await context.bitcoinClient.getAddress();
    const request = {
        appId: context.appId,
        appVk: context.appVk,
        fundingUtxo,
        fundingChangeAddress,
        feerate,
        nextNftAddress: grailAddress,
        ticker: context.ticker,
        currentNftState: {
            publicKeysAsString: initialNftState.publicKeys.join(','),
            threshold: initialNftState.threshold,
        },
        toYamlObj: function () {
            return {
                version: 4,
                apps: { $00: `n/${this.appId}/${this.appVk}` },
                private_inputs: {
                    $00: `${this.fundingUtxo.txid}:${this.fundingUtxo.vout}`,
                },
                public_inputs: { $00: { action: 'deploy' } },
                ins: [],
                outs: [
                    {
                        address: this.nextNftAddress,
                        charms: {
                            $00: {
                                ticker: this.ticker,
                                current_cosigners: this.currentNftState.publicKeysAsString,
                                current_threshold: this.currentNftState.threshold,
                            },
                        },
                    },
                ],
            };
        },
    };
    const spell = await (0, spells_1.createSpell)(context, [], request);
    logger_1.logger.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, 2));
    if (transmit) {
        return await (0, spell_operations_1.transmitSpell)(context, spell);
    }
    return ['', ''];
}
async function deployNftCli(_argv) {
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
    if (!argv['deployer-public-key']) {
        throw new Error('--deployerPublicKey is required');
    }
    const deployerPublicKey = Buffer.from(argv['deployer-public-key'].trim().replace('0x', ''), 'hex');
    if (!argv['feerate']) {
        throw new Error('--feerate is required');
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const transmit = !!argv['transmit'];
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();
    const network = argv['network'];
    const context = await context_1.Context.createForDeploy({
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: consts_1.ZKAPP_BIN,
        network: network,
        mockProof: !!argv['mock-proof'],
        ticker: consts_1.TICKER,
    }, fundingUtxo);
    const [_, spellTxid] = await deployNft(context, deployerPublicKey, feerate, fundingUtxo, transmit);
    // if (network === 'regtest') {
    // 	await context.bitcoinClient.generateBlocks([commitTxid, spellTxid]);
    // }
    return {
        appId: context.appId,
        appVk: context.appVk,
        spellTxid
    };
}
if (require.main === module) {
    deployNftCli(process.argv.slice(2))
        .catch(error => {
        logger_1.logger.error('Error during NFT deployment:', error);
    })
        .then(flag => {
        if (flag) {
            logger_1.logger.log('NFT deployment completed successfully.');
        }
        else {
            logger_1.logger.error('NFT deployment failed.');
        }
        process.exit(flag ? 0 : 1);
    });
}
