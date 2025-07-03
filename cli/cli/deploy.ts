import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress } from '../core/taproot-address';
import { Network } from '../core/taproot/taptree';
import { DeployRequest } from '../core/types';

import config from './config.json';

const deployYamlTemplate = `
version: 4
apps:
  $00: n/{{appId}}/{{appVk}}
public_inputs:
  $00: 
    action: deploy
ins:
outs:
  - address: {{nextNftAddress}}
    charms:
      $00:
        current_cosigners: {{currentNftState.publicKeys}}
        current_threshold: {{currentNftState.threshold}}
`;

export async function deployNft(
    network: Network,
    feeRate: number,
    deployerPublicKey: Buffer
) {

    const bitcoinClient = await BitcoinClient.create();

    const grailAddress = generateGrailPaymentAddress([deployerPublicKey.toString('hex')], 1, network);
    const fundingChangeAddress = await bitcoinClient.getAddress();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();

    const request: DeployRequest = {
        fundingUtxo,
        fundingChangeAddress,
        feeRate,
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeys: deployerPublicKey.toString('hex'),
            threshold: 1
        }
    };

    const spell = await createSpell(bitcoinClient, deployYamlTemplate, [], request);
    if (!spell || spell.length !== 2) {
        throw new Error('Spell creation failed');
    }

    console.info('Spell created successfully, transmitting...');
    await transmitSpell(bitcoinClient, spell);
}

async function main() {

    const argv = minimist(process.argv.slice(2), {
        alias: {
            pubkey: 'deployer-public-key',
            feerate: 'fee-rate'
        },
        default: {
            feerate: config.feerate,
            network: config.network,
            pubkey: config.deployerPublicKey
        },
        '--': true
    });

    const network = argv['network'] as Network;
    const feeRate = Number.parseInt(argv['fee-rate']);
    const deployerPublicKey = Buffer.from(argv['deployer-public-key'], 'hex');

    await deployNft(network, feeRate, deployerPublicKey);
    console.log('NFT deployment completed successfully');
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT deployment:', error);
    });
}
