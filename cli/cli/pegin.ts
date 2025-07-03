import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress } from '../core/taproot-address';
import { Network } from '../core/taproot/taptree';
import { MintRequest, utxoFromUtxoId } from '../core/types';

import config from './config.json';

const peginYamlTemplate = `
version: 4
apps:
 $00: n/{{appId}}/{{appVk}}
public_inputs:
 $00: 
  action: update
 $01:
  action: mint
ins:
 - utxo_id: {{previousNftUtxoId}}
outs:
 - address: {{nextNftAddress}}
   charms:
    $00:
     current_cosigners: {{currentNftState.publicKeys}}
     current_threshold: {{currentNftState.threshold}}
 - address: {{userWalletAddress}}
   charms:
    $01:
     amount: {{amount}}
`;

export async function mintToken(
    network: Network,
    feeRate: number,
    amount: number,
    userWalletAddress: string,
    previousNftUtxoId: string,
    deployerPublicKey: Buffer
) {

    const bitcoinClient = await BitcoinClient.create();

    const grailAddress = generateGrailPaymentAddress([deployerPublicKey.toString('hex')], 1, network);
    const fundingChangeAddress = await bitcoinClient.getAddress();
    const fundingUtxo = await bitcoinClient.getFundingUtxo();

    const request: MintRequest = {
        fundingUtxo,
        fundingChangeAddress,
        feeRate,
        nextNftAddress: grailAddress,
        currentNftState: {
            publicKeys: deployerPublicKey.toString('hex'),
            threshold: 1
        },
        amount,
        userWalletAddress,
        previousUtxo: utxoFromUtxoId(previousNftUtxoId)
    };

    const previousNftTransactionHex = await bitcoinClient.getTransaction(request.previousUtxo.txid);

    const spell = await createSpell(bitcoinClient, peginYamlTemplate, [previousNftTransactionHex], request);
    if (!spell || spell.length !== 2) {
        throw new Error('Spell creation failed');
    }

    console.info('Spell created successfully, transmitting...');
    await transmitSpell(bitcoinClient, spell);
}

async function main() {

    const argv = minimist(process.argv.slice(2), {
        alias: {
            n: 'network',
            p: 'deployer-public-key',
            f: 'fee-rate',
            a: 'amount',
            u: 'previous-nft-utxo-id',
        },
        default: {
            'feerate': config.feerate,
            'network': config.network,
            'pubkey': config.deployerPublicKey,
            'amount': 1,
            'user-wallet-address': config.userWalletAddress,
        },
        '--': true
    });

    const network = argv['network'] as Network;
    const feeRate = Number.parseInt(argv['fee-rate']);
    const deployerPublicKey = Buffer.from(argv['deployer-public-key'], 'hex');
    const amount = Number.parseInt(argv['amount']);
    const userWalletAddress = argv['user-wallet-address'] as string;
    const previousNftUtxoId = argv['previous-nft-utxo-id'] as string;

    await mintToken(network, feeRate, amount, userWalletAddress, previousNftUtxoId, deployerPublicKey);
    console.log('NFT deployment completed successfully');
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error during NFT deployment:', error);
    });
}
