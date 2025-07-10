import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, injectGrailSignaturesIntoTxInput, KeyPair } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { PegInRequest } from '../core/types';
import { showSpell } from '../core/charms-sdk';
import * as bitcoin from 'bitcoinjs-lib';

import config from './config.json';


export async function createPegInSpell(
  network: Network,
  feeRate: number,
  previousNftTxid: string,
  currentPublicKeys: string[],
  currentThreshold: number,
  amount: number,
  userWalletAddress: string
): Promise<Buffer[]> {

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

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  const request: PegInRequest = {
    fundingUtxo,
    fundingChangeAddress,
    feeRate,
    previousNftTxid,
    nextNftAddress: grailAddress,
    currentNftState: {
      publicKeys: currentPublicKeys.join(','),
      threshold: currentThreshold
    },
    amount,
    userWalletAddress,

    toYamlObj: function () {
      return ({
        version: 4,
        apps: {
          $00: `n/${config.appId}/${config.appVk}`,
          $01: `t/${config.appId}/${config.appVk}`
        },
        public_inputs: {
          $00: { action: 'update' },
          $01: { action: 'mint' }
        },
        ins: [{
          utxo_id: `${previousNftTxid}:0`,
          charms: {
            $00: {
              ticker: config.ticker,
              current_cosigners: previousPublicKeys.join(','),
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
        }, {
          address: this.userWalletAddress,
          charms: {
            $01: {
              amount: this.amount
            }
          }
        }]
      });
    }
  };

  const spell = await createSpell(bitcoinClient, [previousNftTxid], request);
  return spell;
}

export async function signAndTransmitSpell(
  commitTxHex: string,
  spell: Buffer[],
  keyPairs: KeyPair[],
  previousNftTxid: string,
  network: Network,
  transmit: boolean): Promise<void> {

  const bitcoinClient = await BitcoinClient.create();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }

  const previousSpellData = await showSpell(previousNftTxhex);
  console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  if (!spell || spell.length !== 2) {
    throw new Error('Spell creation failed');
  }
  const commitmentTxHex = spell[0].toString('hex');
  const spellTxhex = spell[1].toString('hex');

  const tx = bitcoin.Transaction.fromHex(spellTxhex);

  const labeledSignatures = await grailSignTx(
    commitmentTxHex,
    spellTxhex,
    previousPublicKeys, previousThreshold,
    keyPairs, network);

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
      'previous-nft-txid': 'dffab639dae566030bf76b55082558a55f0e581c7db7e47d354d6f94635df247',
      'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'amount': 1000,
      'user-wallet-address': config.userWalletAddress,
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
  const amuont = Number.parseInt(argv['amount']);
  const userWalletAddress = argv['user-wallet-address'] as string;
  const transmit = !!argv['transmit'];

  const spell = await createPegInSpell(network, feeRate, previousNftTxid, currentPublicKeys, currentThreshold, amuont, userWalletAddress);
  // const spell = [
  //   '020000000147de94b3fc196b2b61a8426d24f7d8ef2e6cc738059ea6d43c868a3c3ce70eb30100000000ffffffff01b9e1052a01000000225120f315dde07c6574d4e800dca1d7d54169341d548e7d74844c886844473f98da6600000000',
  //   '0200000000010292ffcd600d6b65e926534140b0b4aef460f040c99e523e75cb329bd5a123c8c50000000000ffffffff8a01516c5a36ab94889d36382e00a8520d873a6ce44a44fbf614aeb6d96d62b60000000000ffffffff03e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fabed9052a010000001600149b1f19d31159c585660144937096f26d8cea702c000341850db6ee12e33eeeb1ac2245f8c3f5477b3f557254a3b412820ad6554b05bf683ec15a26d2aea07832df0f332f113561791b79454e0174230045f434a80decaa81fd35040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747382a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a101a166616d6f756e741903e8716170705f7075626c69635f696e70757473a283616e9820189518dc189318ab1821189518da183018f9184c185718a318cc189618cc18ba18ca18ba18bc18fa18b3188e183a188318b617188c051893187e182318579820183d0d18a31857186e183518a20118b4189718da1518be18cb1881183c18eb185b184d031873182318b1185b18eb182d18d4184b0d18b418301858a166616374696f6e667570646174658361749820189518dc189318ab1821189518da183018f9184c185718a318cc189618cc18ba18ca18ba18bc18fa18b3188e183a188318b617188c051893187e182318579820183d0d18a31857186e183518a20118b4189718da1518be18cb1881183c18eb185b184d031873182318b1185b18eb182d18d4184b0d18b418301858a1664dfc01616374696f6e646d696e7499010418a41859184c18590b18d018e31885184918501878187d186918e011184218b218a718941318971882185e1865185f187918ce0018f71898186f18c618b618c41818183c182f188d18cb184218a618a5188a184b1854189c1882061842183918301847182f186f1840188318bf1866189f18d118780f18e818b6184a18bd0a188e18291866186f18fb18e618e7189018570b1518871884185a181f18ec1518b018a218800518f4188a189d1882183b18b2189e183418c418cb18b21878182a187318ca18a51218b918b518c318e118be1895183e18851890182f185018a4187518c7186c18c8186210183f184b18db16186d185218c71819182d182a181f18d81830187f184b18a418c1184918b918471877182618df18f1184c18b506187a183518d0183a185618a418f6188618fa184e0a17183e185f13189514189d18f4181904187418e401182a1318ec18c71876188d18dd18f6187e18c018cd183a1823181f18a91858188c18fb18a91875184318cf181f18c3189f1871182218bf185418d9188e187d18b918ab182418cd183618f20a18f018db1881189518d618c2181818f118361889130e18cc1848187918231886183318f4187e18d5184e188518b0181c187b183718650118f9187e18a518bf188b18d2186118d7183e182518d718fa18a5183218fd18e7188318f468201ecfa113873c886aa996af283f38388e6fdf57672a6736fb732af8e22d2e2873ac21c11ecfa113873c886aa996af283f38388e6fdf57672a6736fb732af8e22d2e287300000000'
  // ].map(hex => Buffer.from(hex, 'hex'));

  const tx = bitcoin.Transaction.fromHex(spell[1].toString('hex'));

  const bitconClient = await BitcoinClient.create();
  const utxo = await bitconClient.getFundingUtxo();
  tx.addInput(Buffer.from(utxo.txid, 'hex').reverse(), utxo.vout);
  tx.addOutput(tx.outs[0].script, 1000);
  spell[1] = Buffer.from(tx.toHex(), 'hex');

  await signAndTransmitSpell(
    spell[0].toString('hex'),
    spell,
    [{ publicKey: Buffer.from(deployerPublicKey, 'hex'), privateKey: Buffer.from(deployerPrivateKey, 'hex') }],
    previousNftTxid,
    network,
    transmit
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
