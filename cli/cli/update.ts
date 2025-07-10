import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, injectGrailSignaturesIntoTxInput } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { UpdateRequest } from '../core/types';
import { showSpell } from '../core/charms-sdk';

import config from './config.json';
import { deepEqual, SOME_STRING } from '../core/deep-equal';

interface PreviousSpellData {
  "version": number,
  "apps": { "$0000": string },
  "public_args": { "$0000": { "action": string } },
  "ins": never[],
  "outs": {
    "charms": {
      "$0000": {
        "current_cosigners": string,
        "current_threshold": number
      }
    }
  }[]
};

export async function updateNft(
  network: Network,
  feeRate: number,
  previousNftTxid: string,
  currentPublicKeys: string[],
  currentThreshold: number,
  deployerPublicKey: Buffer,
  deployerPrivateKey: Buffer,
  transmit: boolean
) {

  const bitcoinClient = await BitcoinClient.create();

  const grailAddress = generateGrailPaymentAddress(currentPublicKeys, currentThreshold, network);
  const fundingChangeAddress = await bitcoinClient.getAddress();
  const fundingUtxo = await bitcoinClient.getFundingUtxo();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }
  const previousSpellData = await showSpell(previousNftTxhex);
  console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
  if (!previousSpellData) {
    throw new Error('Invalid previous NFT spell data');
  }

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  const request: UpdateRequest = {
    fundingUtxo,
    fundingChangeAddress,
    feeRate,
    previousNftTxid,
    nextNftAddress: grailAddress,
    currentNftState: {
      publicKeys: currentPublicKeys.join(','),
      threshold: currentThreshold
    },

    toYamlObj: function () {
      return ({
        version: 4,
        apps: { $00: `n/${config.appId}/${config.appVk}` },
        public_inputs: { $00: { action: 'update' } },
        ins: [{
          utxo_id: `${previousNftTxid}:0`,
          charms: {
            $00: {
              ticker: config.ticker,
              current_cosigners: previousPublicKeys,
              current_threshold: previousThreshold
            }
          }
        }],
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

  const spell = await createSpell(bitcoinClient, [previousNftTxid], request);

  // const spell = ["0200000001e1b6448704b3f0451d1f35eea58b5386ea111df495f0d1471daa0ef3c86c33960000000000ffffffff0122f80295000000002251207b71baf7bb233bd1312d6f9df5312ef19a7891148cb71a1782e3c5ee3bb2f2dc00000000","020000000001026cc7a1224192f845066ea87dd63c15d7b6131ab5ab8dde62e320377641a82a0f0000000000ffffffff97b47e1b07f50188391480007fe8d5a047708fd9adf15ab951b79362694ea53a0000000000ffffffff02e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2a2f402950000000016001426ec35073b18c8ef9b1d0b7012a7e062de349e1f000341b0501a86b0dedb71edb66b65456840c28e56309da07e2f1db392ef64a8d62c4a6832a45d111b1e4243c315ed4546dc7278e24badedc5e2376a439616daaeaae681fd8c030063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747381a100a27163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401716170705f7075626c69635f696e70757473a183616e982018a0187d1829185218d618a118e318b118c418f518901862188318c0181c186a184418211820189d18a1183c18f218ca182618ec18ab181d12187d18fb18e198201826186a185f182f03185918ca185d1859188118d7183d184218991829186d18281893189c181d181818ba18371870185818790a1839188e18ac18b302a166616374696f6e6675706461746599010418a41859184c18590518fa18bf186f18b118f118b118ca184e11183011183b18b21830186b1865189c18241822188d1843185716189418ef183411184e183c18c118281418cc1418e1188718f6187d07181d189a18d518d3181d021895188218c218581889182e18da18aa1849182e18a3185218b5188018df1865181818c4181f186b101859186818681897184d187510187418c318bd18a8184d53013e18331892186a187b18b51880185d18a618d9182d18461853185610187b184e18e611186418ef18ea18ef183518a618cc18fd185818221827185d186f185818f21880181a185618c7184e18ba18a0186818d6181918ca1838184b1830184d18ae0418db18ba071861182c18f0011832181d189f188618eb1850186e184c18a6182818dc186018ac0d185018da185918d8181e189d18b3186118bf18ea1118d618a91118ad182018b218dc18f90318a718ec1889188d186e188618231897189e1878182318a8183d1864183c187c186a18ad184818321879189101184d18ff18b3187218c918b918be18f71856186f18cc18f118ea18de18911880189c18b418d918d718fe18e7183218331867181818f0185118a4182918820a18b618c418e618f418e61718981852186f187918e618ad184b187c1839181f0a0918a818e9184e18de182e18dc182d182418cc18300b11188f68202fae892a9cb243f996fb83d17f29850d027a4e63d2c27141e70068528e9ce6c6ac21c02fae892a9cb243f996fb83d17f29850d027a4e63d2c27141e70068528e9ce6c600000000"]
  //   .map(hex => Buffer.from(hex, 'hex'));

  if (!spell || spell.length !== 2) {
    throw new Error('Spell creation failed');
  }
  const commitmentTxHex = spell[0].toString('hex');
  const spellTxhex = spell[1].toString('hex');

  const labeledSignatures = await grailSignTx(
    commitmentTxHex, spellTxhex, previousPublicKeys, previousThreshold,
    [{ publicKey: deployerPublicKey, privateKey: deployerPrivateKey }], network);

  const signedTransaction = injectGrailSignaturesIntoTxInput(
    spellTxhex, previousPublicKeys, previousThreshold, labeledSignatures, network);

  const signedSpell = [Buffer.from(commitmentTxHex, 'hex'), Buffer.from(signedTransaction, 'hex')];

  if (transmit) {
    console.info('Spell created successfully, transmitting...');
    await transmitSpell(bitcoinClient, signedSpell);
  }
}

async function main() {

  const argv = minimist(process.argv.slice(2), {
    alias: {},
    default: {
      'network': config.network,
      'feerate': config.feerate,
      'deployer-public-key': config.deployerPublicKey,
      'deployer-private-key': config.deployerPrivateKey,
      'previous-nft-txid': config.firstNftTxid,
      'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'transmit': true
    },
    '--': true
  });

  const network = argv['network'] as Network;
  const feeRate = Number.parseInt(argv['feerate']);
  const deployerPublicKey = argv['deployer-public-key'] as string;
  const deployerPrivateKey = argv['deployer-private-key'] as string;
  const previousNftTxid = argv['previous-nft-txid'] as string;
  const currentPublicKeys = (argv['current-public-keys'] as string).split(',').map(pk => pk.trim());
  const currentThreshold = Number.parseInt(argv['current-threshold']);
  const transmit = !!argv['transmit'];

  await updateNft(network, feeRate, previousNftTxid,
    currentPublicKeys, currentThreshold,
    Buffer.from(deployerPublicKey, 'hex'), Buffer.from(deployerPrivateKey, 'hex'),
    transmit);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
