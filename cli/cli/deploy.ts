import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { DeployRequest } from '../core/types';
import { getVerificationKey } from '../core/charms-sdk';

import config from './config.json';

const APP_ID = '54bcbe0b568bed707af3fb5e00f57d6948e19a3ef599bf35fac7632d76fbc203';

export async function deployNft(
    network: Network,
    feeRate: number,
    deployerPublicKey: Buffer,
    transmit: boolean
) {

    const bitcoinClient = await BitcoinClient.create();

    const grailAddress = generateGrailPaymentAddress([deployerPublicKey.toString('hex')], 1, network);
    const fundingChangeAddress = await bitcoinClient.getAddress();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();

    const appVk = '1209ee41a332ba5e0fdf6510931b3b1b63df846e0a96333217046a19a18a4f0b'; // await getVerificationKey();

    const request: DeployRequest = {
        fundingUtxo,
        fundingChangeAddress,
        feeRate,
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeys: deployerPublicKey.toString('hex'),
            threshold: 1
        },

        toYamlObj: function () {
            return ({
                version: 4,
                apps: {
                    $00: `n/${APP_ID}/${appVk}`
                },
                public_inputs: {
                    $00: {
                        action: 'deploy'
                    }
                },
                ins: [],
                outs: [
                    {
                        address: this.nextNftAddress,
                        charms: {
                            $00: {
                                current_cosigners: this.currentNftState.publicKeys,
                                current_threshold: this.currentNftState.threshold
                            }
                        }
                    }
                ]
            });
        }
    };

    const spell = await createSpell(bitcoinClient, [], request);
    if (!spell || spell.length !== 2) {
        throw new Error('Spell creation failed');
    }

    if (transmit) {
        console.info('Spell created successfully, transmitting...');
        await transmitSpell(bitcoinClient, spell);
    }
}

async function main() {

    const argv = minimist(process.argv.slice(2), {
        alias: {},
        default: {
            'network': config.network,
            'feerate': config.feerate,
            'deployer-public-key': config.deployerPublicKey,
            'transmit': true
        },
        '--': true
    });

    const network = argv['network'] as Network;
    const feeRate = Number.parseInt(argv['feerate']);
    const deployerPublicKey = Buffer.from(argv['deployer-public-key'], 'hex');
    const transmit = !!argv['transmit'];

    await deployNft(network, feeRate, deployerPublicKey, transmit);
    console.log('NFT deployment completed successfully');
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT deployment:', error);
    });
}
