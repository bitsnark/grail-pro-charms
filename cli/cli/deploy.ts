import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { DeployRequest } from '../core/types';
import { getVerificationKey } from '../core/charms-sdk';

import config from './config.json';
import { sha256 } from 'bitcoinjs-lib/src/crypto';

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

    const appId = sha256(Buffer.from(`${fundingUtxo.txid}:${fundingUtxo.vout}`, 'ascii')).toString('hex');
    console.log('App ID:', appId);

    const appVk = await getVerificationKey();
    console.log('App Verification Key:', appVk);

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
                apps: { $00: `n/${appId}/${appVk}` },
                private_inputs: { $00: `${fundingUtxo.txid}:${fundingUtxo.vout}` },
                public_inputs: { $00: { action: 'deploy' } },
                ins: [],
                outs: [{
                    address: this.nextNftAddress,
                    charms: {
                        $00: {
                            ticker: config.ticker,
                            current_cosigners: this.currentNftState.publicKeys,
                            current_threshold: this.currentNftState.threshold
                        }
                    }
                }]
            });
        }
    };

    const spell = await createSpell(bitcoinClient, [], request);
    if (!spell || spell.length !== 2) {
        throw new Error('Spell creation failed');
    }

    if (transmit) {
        console.info('Spell created successfully, transmitting...');
        const txids = await transmitSpell(bitcoinClient, spell);

        console.log('Set your config:');;
        console.log(`\t"appId": "${appId}",`);
        console.log(`\t"appVk": "${appVk}",`);
        console.log(`\t"firstNftTxid": "${txids[1]}",`);
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
