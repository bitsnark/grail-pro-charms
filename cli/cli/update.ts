import minimist from 'minimist';
import * as yaml from 'js-yaml';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, signTaprootInputRawTx } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { DeployRequest, UpdateRequest } from '../core/types';
import { getVerificationKey, showSpell } from '../core/charms-sdk';

import config from './config.json';
import { deepEqual, SOME_STRING } from '../core/deep-equal';

interface PreviousSpellData {
  "version": number,
  "apps": {
    "$0000": string
  },
  "public_args": {
    "$0000": {
      "action": string
    }
  },
  "ins": never[],
  "outs":
  {
    "charms": {
      "$0000": {
        "current_cosigners": string,
        "current_threshold": number
      }
    }
  }[]
};


function checkPreviousSpellData(previousSpellData: PreviousSpellData, appVk: string): boolean {
  return previousSpellData && deepEqual<PreviousSpellData>(previousSpellData, {
    "version": 4,
    "apps": {
      "$0000": `n/${config.appId}/${appVk}`
    },
    "public_args": {
      "$0000": {
        "action": "deploy"
      }
    },
    "ins": [],
    "outs": [
      {
        "charms": {
          "$0000": {
            "current_cosigners": SOME_STRING,
            "current_threshold": 1
          }
        }
      }
    ]
  }, { ignoreMissingInTarget: true });
}

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

  // const grailAddress = generateGrailPaymentAddress(currentPublicKeys, currentThreshold, network);
  // const fundingChangeAddress = await bitcoinClient.getAddress();
  // const fundingUtxo = await bitcoinClient.getFundingUtxo();

  // const appVk = '1209ee41a332ba5e0fdf6510931b3b1b63df846e0a96333217046a19a18a4f0b'; // await getVerificationKey();

  // const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  // if (!previousNftTxhex) {
  //   throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  // }
  // const previousSpellData = await showSpell(previousNftTxhex);
  // console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
  // if (!previousSpellData || !checkPreviousSpellData(previousSpellData, appVk)) {
  //   throw new Error('Invalid previous NFT spell data');
  // }

  // const request: UpdateRequest = {
  //   fundingUtxo,
  //   fundingChangeAddress,
  //   feeRate,
  //   previousNftTxid,
  //   nextNftAddress: grailAddress,
  //   currentNftState: {
  //     publicKeys: currentPublicKeys.join(','),
  //     threshold: currentThreshold
  //   },

  //   toYamlObj: function () {
  //     return ({
  //       version: 4,
  //       apps: {
  //         $00: `n/${config.appId}/${appVk}`
  //       },
  //       public_inputs: {
  //         $00: {
  //           action: 'update'
  //         }
  //       },
  //       ins: [
  //         {
  //           utxo_id: `${previousNftTxid}:0`,
  //           charms: {
  //             $00: {
  //               current_cosigners: previousSpellData.outs[0].charms['$0000'].current_cosigners,
  //               current_threshold: previousSpellData.outs[0].charms['$0000'].current_threshold
  //             }
  //           }
  //         }
  //       ],
  //       outs: [
  //         {
  //           address: this.nextNftAddress,
  //           charms: {
  //             $00: {
  //               current_cosigners: this.currentNftState.publicKeys,
  //               current_threshold: this.currentNftState.threshold
  //             }
  //           }
  //         }
  //       ]
  //     });
  //   }
  // };

  // const spell = await createSpell(bitcoinClient, [previousNftTxid], request);
  // if (!spell || spell.length !== 2) {
  //   throw new Error('Spell creation failed');
  // }

  const spell = ["0200000001fed10dd5693f980110539ee2c1c44198faed1d29945013fbf9268c0dc2290e590000000000ffffffff0122f1052a01000000225120c68f6d7772bf63aa79cb33957f1c0c3fa7ab44453557e5bf4ec1d7156237587c00000000", "02000000000102e311eee69686f62f69eaf1320ce3835b509d625a418cfe18072298dcb98d6e8a0000000000ffffffff47c1a955583756bcbdaafc5be113394652f68041a9c72a8c40abbeeb8e03db280000000000ffffffff02e80300000000000022512054dc8817a99997affce036423647f30a039c43cf36104ee46257b0d0d5a068f7a4ed052a010000001600142ceb6ff08b1ded6d2891987f7f34e1bcd03094a50003410a81d292498e2bc3cdabf05d7f10bc806d01187f4de81847e86edf6781fa77a5fbae9f0fe24b0c958e121243ba90117783433fc80002e439760ebf0ff6bf37c081fd87030063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747381a100a27163757272656e745f636f7369676e65727378853032633432633632393036633537383461343139646262643763386563366161326539633632356634346566313735613431373439613463333230383739656361312c3032393131623864376364663537613165373735383538376466363631373234303762336534353934343030336239386638666265363930643462336364383962317163757272656e745f7468726573686f6c6401716170705f7075626c69635f696e70757473a183616e9820185418bc18be0b1856188b18ed1870187a18f318fb185e0018f5187d1869184818e1189a183e18f5189918bf183518fa18c71863182d187618fb18c2039820120918ee184118a3183218ba185e0f18df1865101893181b183b181b186318df1884186e0a1896183318321704186a181918a1188a184f0ba166616374696f6e6675706461746599010418a41859184c18591827186718301820186418e6185418ad185618a409188218871835186a18a3184418a80f18f5182d18b41830186918450a186e18b50e185618f30c181a18ed06182c18c818bc183918fd0c18fd189e18a91852189918d118cf186918c7188e185f1848188c1820186f1897188d1881187418fa02183c183615186118db187418bc18be18be18a318a118a6187518b81822185118594d4e01189e1860184218c018c118ba0218a918b918fe1867188c1828181f181a185318d50618ab18f718ca0b0d18d3183618bd183118b118e418be18ea10182718d2183a186c0a1865183218d50d183b182b181a189618b718b3189e18dd0f18591892187818b618cf041865189518ae18ea1899189518ed189b18421877183518ec188b184618cc18e3186318c818a5183d188118c118e518b8189e0517182b1864185f14182318fb1897184b188a18f418eb187a0d18c9187718a818c118b5183d171875188f18a318fd186418e3184418b018b9181a080b184718bf18c318c418fa183c18f5187618a318d218e41842188c18951889185b183b18a01896186518dd1855081823181e1874091863186e1856181e18d510184d181e1887188718991878184718301888188418d3181b18db18241830188c18a918fa1857181c185b184218531849181a0c18db1840189068209b96118998b8961c48831bbc8a2b827e2fd643927740fada1854e20e3eb02aecac21c19b96118998b8961c48831bbc8a2b827e2fd643927740fada1854e20e3eb02aec00000000"];

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }

  grailSignTx(previousNftTxhex, spell[1], currentPublicKeys, currentThreshold, [deployerPrivateKey], network);


  if (transmit) {
    console.info('Spell created successfully, transmitting...');
    await transmitSpell(bitcoinClient, spell.map(tx => Buffer.from(tx, 'hex')));
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
      'previous-nft-txid': '8a6e8db9dc98220718fe8c415a629d505b83e30c32f1ea692ff68696e6ee11e3',
      'current-public-keys': `02c42c62906c5784a419dbbd7c8ec6aa2e9c625f44ef175a41749a4c320879eca1,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'transmit': true
    },
    '--': true
  });

  const network = argv['network'] as Network;
  const feeRate = Number.parseInt(argv['feerate']);
  const deployerPublicKey = Buffer.from(argv['deployer-public-key'], 'hex');
  const deployerPrivateKey = Buffer.from(argv['deployer-private-key'], 'hex');
  const previousNftTxid = argv['previous-nft-txid'] as string;
  const currentPublicKeys = (argv['current-public-keys'] as string).split(',').map(pk => pk.trim());
  const currentThreshold = Number.parseInt(argv['current-threshold']);
  const transmit = !!argv['transmit'];

  await updateNft(network, feeRate, previousNftTxid, currentPublicKeys, currentThreshold, deployerPublicKey, deployerPrivateKey, transmit);
  console.log('NFT deployment completed successfully');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
