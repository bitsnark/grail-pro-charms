import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { generateUserPaymentAddress } from '../core/taproot';
import { Network } from '../core/taproot/taptree';

import config from './config.json';
import { generateRandomKeypair } from './generate-random-keypairs';

async function main() {

  const argv = minimist(process.argv.slice(2), {
    alias: {},
    default: {
      'network': config.network,
      'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'amount': 1000
    },
    '--': true
  });

  const network = argv['network'] as Network;
  const currentPublicKeys = (argv['current-public-keys'] as string).split(',').map(pk => pk.trim());
  const currentThreshold = Number.parseInt(argv['current-threshold']);
  const amuont = Number.parseInt(argv['amount']);

  const bitcoinClient = await BitcoinClient.create();

  const recoveryKeypair = generateRandomKeypair();
  console.log('Recovery Keypair:', recoveryKeypair);
  
  const userPaymentAddress = generateUserPaymentAddress(
    recoveryKeypair.publicKey.toString('hex'),
    currentPublicKeys,
    config.userTimelockBlocks,
    currentThreshold,
    network);

  await bitcoinClient.fundAddress(userPaymentAddress, amuont);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
