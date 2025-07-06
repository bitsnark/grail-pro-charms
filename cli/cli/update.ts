import minimist from 'minimist';
import * as yaml from 'js-yaml';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, injectGrailSignaturesIntoTxInut } from '../core/taproot';
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
  deployerPublicKey: string,
  deployerPrivateKey: string,
  transmit: boolean
) {

  const bitcoinClient = await BitcoinClient.create();

  const grailAddress = generateGrailPaymentAddress(currentPublicKeys, currentThreshold, network);
  const fundingChangeAddress = await bitcoinClient.getAddress();
  const fundingUtxo = await bitcoinClient.getFundingUtxo();

  const appVk = '1209ee41a332ba5e0fdf6510931b3b1b63df846e0a96333217046a19a18a4f0b'; // await getVerificationKey();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }
  const previousSpellData = await showSpell(previousNftTxhex);
  console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));
  if (!previousSpellData || !checkPreviousSpellData(previousSpellData, appVk)) {
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
        apps: {
          $00: `n/${config.appId}/${appVk}`
        },
        public_inputs: {
          $00: {
            action: 'update'
          }
        },
        ins: [
          {
            utxo_id: `${previousNftTxid}:0`,
            charms: {
              $00: {
                current_cosigners: previousPublicKeys,
                current_threshold: previousThreshold
              }
            }
          }
        ],
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

  // const spell = await createSpell(bitcoinClient, [previousNftTxid], request);
  // if (!spell || spell.length !== 2) {
  //   throw new Error('Spell creation failed');
  // }

  const spell = ["0200000001fbb773e40b1f799808e85929f9f9f309ff7bcecce8e62cd3c931dd67b9265fd00000000000ffffffff0122f8029500000000225120c6101dbf3cf2b6117f21a3c0d8b76eb5efbc3e453618020a203584b6223320ce00000000","020000000001012c0e0df36f0a8ac8f10a6646626f660e2c79c2a41813d7eb9e3a51e3c175a2dd0000000000ffffffff02e803000000000000225120908b3500ab83c65b10de8b11224129515e17722b17b9e2ae9bb813d30703aa1c4ff1029500000000160014296f1d2e92403de619e3e9bd34af8cd2fd0febd103418bfb30857aaa137bb82e10f61052da878fabe00ce0930254648fe7ed183dfabf71b28994ec85501d5fa4aeb721bba4c932e65d36eaf6c41e8fa3a057e0d2751881fd45030063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747381a100a27163757272656e745f636f7369676e65727378423032393131623864376364663537613165373735383538376466363631373234303762336534353934343030336239386638666265363930643462336364383962317163757272656e745f7468726573686f6c6401716170705f7075626c69635f696e70757473a183616e9820185418bc18be0b1856188b18ed1870187a18f318fb185e0018f5187d1869184818e1189a183e18f5189918bf183518fa18c71863182d187618fb18c2039820120918ee184118a3183218ba185e0f18df1865101893181b183b181b186318df1884186e0a1896183318321704186a181918a1188a184f0ba166616374696f6e666465706c6f7999010418a41859184c1859021868188118e8186e18d318b518c11842186618a51857181d1819051879185e18af182f1850184c18821218a118420c18c8185f186018ee181918a31827184218c418f318e718961859187f184d0d18270f18d4187818ae18470918ea18d318d5184418e7182400185318c41836188b1879182e1878186e0f1878184d18901869181818e418de181a184c188d0e1852181c186d18d818f718be183118751218eb15189a184618a818f618b5161882183118a70218d9188018be1881187a0918841887187a189b185b183f18f6185f188a03001860181b184d0c018a181b18d8184718c118c5181d186418d41850188418a009182b182b18561847188a186618b9184c18e5183e187318d8183318e518ad181c18a4184a18f118fe18ec18d2182a18c0187b18f618b618b5182b18f118a70718a618181876189518ce0118b1187a187b18da185d1828186c18f0184918771826186a186c18ff184d181918371894184a186918521892121842183c040d185216182418e718ec18bc1897182c18f5185d18c61819185a18fd184b187f18f218a818c618cc18dc186a1855188718fd18f718671018da18f40518aa18d118dc1887184b18bb011891181b18ba188218f518d018d518cc185218a9182a18af18851844189b186318f918ba181b18b0189a187901188368206cd973343241de158ad532dadfac40f5d12f98a9f24869901256071fe1677ce9ac21c16cd973343241de158ad532dadfac40f5d12f98a9f24869901256071fe1677ce900000000"];

  const labeledSignatures = grailSignTx(
    spell[0], previousNftTxhex, spell[1], previousPublicKeys, previousThreshold,
    [{ publicKey: deployerPublicKey, privateKey: deployerPrivateKey }], network);

  const signedTransaction = injectGrailSignaturesIntoTxInut(
    spell[1], previousPublicKeys, previousThreshold, labeledSignatures, network);

  spell[1] = signedTransaction;

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
      'previous-nft-txid': config.firstNftTxid,
      'current-public-keys': `02c42c62906c5784a419dbbd7c8ec6aa2e9c625f44ef175a41749a4c320879eca1,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'transmit': true
    },
    '--': true
  });

  const network = argv['network'] as Network;
  const feeRate = Number.parseInt(argv['feerate']);
  const deployerPublicKey = argv['deployer-public-key'];
  const deployerPrivateKey = argv['deployer-private-key'];
  const previousNftTxid = argv['previous-nft-txid'] as string;
  const currentPublicKeys = (argv['current-public-keys'] as string).split(',').map(pk => pk.trim());
  const currentThreshold = Number.parseInt(argv['current-threshold']);
  const transmit = !!argv['transmit'];

  await updateNft(network, feeRate, previousNftTxid, currentPublicKeys, currentThreshold, deployerPublicKey, deployerPrivateKey, transmit);
  console.log('NFT update completed successfully');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
