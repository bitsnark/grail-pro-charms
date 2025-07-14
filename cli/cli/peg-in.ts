import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, KeyPair } from '../core/taproot';
import { GrailState, PegInRequest, Spell, UserPaymentDetails } from '../core/types';
import { showSpell } from '../core/charms-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { getStateFromNft, hashToTxid, prepareSpell, txidToHash } from './utils/signing';
import config from '../config';
import { Network } from '../core/taproot/taproot-common';
import { setupLog } from './utils/log';
import { bufferReplacer } from '../core/json';
import { randomBytes } from 'node:crypto';

async function checkInputsAndOutputs(txBytes: Buffer) {
  const bitcoinClient = await BitcoinClient.create();
  const tx = bitcoin.Transaction.fromBuffer(txBytes);
  let totalInputValue = 0;
  for (const input of tx.ins) {
    const previousTxHex = await bitcoinClient.getTransactionHex(hashToTxid(input.hash));
    const prevTx = bitcoin.Transaction.fromHex(previousTxHex);
    if (!prevTx.outs[input.index]) {
      throw new Error(`Input index ${input.index} out of bounds for transaction ${hashToTxid(input.hash)}`);
    }
    totalInputValue += prevTx.outs[input.index].value;
  }
  let totalOutputValue = 0;
  for (const output of tx.outs) {
    totalOutputValue += output.value;
  }
  console.log(`Total input value: ${totalInputValue}, Total output value: ${totalOutputValue}, Fee: ${totalInputValue - totalOutputValue}`);
}

export async function createPegInSpell(
  feeRate: number,
  previousNftTxid: string,
  grailState: GrailState,
  userPaymentDetails: UserPaymentDetails,
  userWalletAddress: string,
  temporarySecret: Buffer,
  network: Network
): Promise<Spell> {

  const bitcoinClient = await BitcoinClient.create();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }

  const grailAddress = generateGrailPaymentAddress(grailState, network);
  const fundingChangeAddress = await bitcoinClient.getAddress();
  const fundingUtxo = await bitcoinClient.getFundingUtxo();

  const previousSpellData = await showSpell(previousNftTxhex);
  console.log('Previous NFT spell:', JSON.stringify(previousSpellData, null, '\t'));

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  const userPaymentTxHex = await bitcoinClient.getTransactionHex(userPaymentDetails.txid);
  if (!userPaymentTxHex) {
    throw new Error(`User payment transaction ${userPaymentDetails.txid} not found`);
  }
  const userPaymenTx = bitcoin.Transaction.fromHex(userPaymentTxHex);
  const userPaymentAmount = userPaymenTx.outs[0].value;
  console.log('User payment transaction amount:', userPaymentAmount);

  const request: PegInRequest = {
    fundingUtxo,
    fundingChangeAddress,
    feeRate,
    previousNftTxid,
    nextNftAddress: grailAddress,
    currentNftState: {
      publicKeysAsString: grailState.publicKeys.join(','),
      threshold: grailState.threshold
    },
    amount: userPaymentAmount,
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
              current_cosigners: this.currentNftState.publicKeysAsString,
              current_threshold: this.currentNftState.threshold
            }
          }
        }, {
          address: this.nextNftAddress,
          amount: this.amount
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

  // const spell = await createSpell(bitcoinClient, [previousNftTxid], request, temporarySecret);
  const spell = {
    "commitmentTxBytes": Buffer.from("0200000001f01bf90315844ddf938d072ab5f6134d07a744c5904b00c5be059724f894a21d0000000000ffffffff0122f80295000000002251207a2eefa45accea5fe711caa4a3676dd86b847ffabb1924098425589978fc0ea100000000", 'hex'),
    "spellTxBytes": Buffer.from("02000000000102c8d1f29cbd5dd86adf7db91a931859f94c7857bcb7fafbffc2372ff4ddb3068e0000000000fffffffffd78aff9e28e7c41c9ab812d1765e2e0baccae31fc607fbef25daf7c4054373b0000000000ffffffff04e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2a1eb0295000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa38040000000000001600141671b4849e6bee429443efba3fa55e410bc34b15000341aa469ead00c8993e68a4dca0f9277630b1c02beb5838d0f7350e155b8ca471afc2be6f96b93ccd8f96d6a6fe252ceaa62a1534453085c7edc09e32cfba65efc681fd26040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747383a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a0a101a166616d6f756e741a9502eba1716170705f7075626c69635f696e70757473a283616e9820184a187318a118c218f6183518ba182018a318c718321820182c182318f318c418ac185418de18a318bc0318981857184e1896186518ee18ea18b2183b182b982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e667570646174658361749820184a187318a118c218f6183518ba182018a318c718321820182c182318f318c418ac185418de18a318bc0318981857184e1896186518ee18ea18b2183b182b982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da1666163744ded01696f6e646d696e7499010418a41859184c1859182e183418d11869187618a91871185c18241828185c18d018920b182d186818b3185f18a818db1856183118ec183f184918651824182618ac181b1518c31518a7061890184b1820182118c30018c717131819185718d81899188f1218c118ec18ca18c01827182f189518e1187a18731884189218500a182a185f18e618e9181818c6188718a8189f050b0318941847187518ee181e11186318660e18d01896183618fb18ae18ff18c71318c20b18941818182e18df188b18ae1828183f18bb18ab18b418b3182a18b2182318b7186e18c5184d18de0c18b105183a1878184f18851823181f1878183418bb187b182f18d618fb18cb0f182a187a185d18a6186a187418a018af0718fb18b01837010618db18cc187a1856181b187f183318de181a18da0a189718811418a018f5184b18f2189a18c5185518e418d918720f18651893184b1418540118b0183d18ab18e018c2182218d91218fa18e118311863186318d6111848181e187718940a1832021899188c185918f518d418ff18ba186e188d0c182a188018dc185917001850185b18e118db1831186518cc18b0181a18ac188018f901185f18801818140f12185b18f01862181c185c1820186e184e18e81846181a181b1847185918a5186418951862182818e71862682075eed98aed303a779e73c6426c75f4647acfe7b9d11749c5df278556c0893b6cac21c175eed98aed303a779e73c6426c75f4647acfe7b9d11749c5df278556c0893b6c00000000", 'hex')
  } as Spell;

  console.log('Peg-in spell created:', JSON.stringify(spell, bufferReplacer, '\t'));
  return spell;
}

export async function signAndTransmitSpell(
  spell: Spell,
  keyPairs: KeyPair[],
  userPaymentDetails: UserPaymentDetails,
  previousNftTxid: string,
  temporarySecret: Buffer,
  network: Network,
  transmit: boolean): Promise<void> {

  const grailState = await getStateFromNft(previousNftTxid);

  const signedSpell = await prepareSpell(spell, grailState, userPaymentDetails, keyPairs, network, temporarySecret);

  console.log('Signed spell:', JSON.stringify(signedSpell, bufferReplacer, '\t'));

  if (transmit) {
    const bitcoinClient = await BitcoinClient.create();
    console.info('Transmitting...');
    await transmitSpell(bitcoinClient, signedSpell);
  }
}

async function main() {

  setupLog();

  const argv = minimist(process.argv.slice(2), {
    alias: {},
    default: {
      'network': config.network,
      'feerate': config.feerate,
      'deployer-public-key': config.deployerPublicKey,
      'deployer-private-key': config.deployerPrivateKey,
      'previous-nft-txid': config.latestNftTxid,
      'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'user-payment-txid': '719c615fcbeb2d184d9e9e0f0ba428d3315459e25f669eb294061e780d30ee76',
      'recovery-public-key': 'ca97894d66e304b05b472dbbd95b3134b60c294e2fd09f7107deec395daa3e0a',
      'timelock-blocks': 10,
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
  const recoveryPublicKey = argv['recovery-public-key'] as string;
  const timelockBlocks = Number.parseInt(argv['timelock-blocks']);
  const userWalletAddress = argv['user-wallet-address'] as string;
  const userPaymentTxid = argv['user-payment-txid'] as string;
  const transmit = !!argv['transmit'];

  const temporarySecret = Buffer.from(randomBytes(32));

  const userPaymentDetails = { txid: userPaymentTxid, vout: 0, recoveryPublicKey, timelockBlocks };

  const spell = await createPegInSpell(
    feeRate, previousNftTxid,
    { publicKeys: currentPublicKeys, threshold: currentThreshold },
    userPaymentDetails,
    userWalletAddress, temporarySecret, network,);

  await signAndTransmitSpell(
    spell,
    [{ publicKey: Buffer.from(deployerPublicKey, 'hex'), privateKey: Buffer.from(deployerPrivateKey, 'hex') }],
    userPaymentDetails,
    previousNftTxid,
    temporarySecret,
    network,
    transmit
  );
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
  });
}
