"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployNft = deployNft;
const minimist_1 = __importDefault(require("minimist"));
const dotenv_1 = __importDefault(require("dotenv"));
const log_1 = require("../core/log");
const context_1 = require("../core/context");
const bitcoin_1 = require("../core/bitcoin");
const taproot_1 = require("../core/taproot");
const spells_1 = require("../core/spells");
const spell_operations_1 = require("../api/spell-operations");
const env_parser_1 = require("../core/env-parser");
const json_1 = require("../core/json");
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
    console.log('Spell created:', JSON.stringify(spell, json_1.bufferReplacer, '\t'));
    if (transmit) {
        await (0, spell_operations_1.transmitSpell)(context, spell);
    }
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
    if (!argv['deployerPublicKey']) {
        console.error('--deployerPublicKey is required');
        return;
    }
    const deployerPublicKey = Buffer.from(argv['deployerPublicKey'].trim().replace('0x', ''), 'hex');
    if (!argv['feerate']) {
        console.error('--feerate is required');
        return;
    }
    const feerate = Number.parseFloat(argv['feerate']);
    const transmit = !!argv['transmit'];
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();
    const context = await context_1.Context.createForDeploy({
        charmsBin: env_parser_1.parse.string('CHARMS_BIN'),
        zkAppBin: './zkapp/target/charms-app',
        network: argv['network'],
        mockProof: argv['mock-proof'],
        ticker: 'GRAIL-NFT',
    }, fundingUtxo);
    await deployNft(context, deployerPublicKey, feerate, fundingUtxo, transmit);
}
if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT deployment:', error);
    });
}
