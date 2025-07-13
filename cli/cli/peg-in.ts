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
  userPaymenTxid: string,
  userPaymentDetails: UserPaymentDetails,
  userWalletAddress: string,
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

  const userPaymentTxHex = await bitcoinClient.getTransactionHex(userPaymenTxid);
  if (!userPaymentTxHex) {
    throw new Error(`User payment transaction ${userPaymenTxid} not found`);
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

  const spell = await createSpell(bitcoinClient, [previousNftTxid], request);
  // const spell = {
  //   "commitmentTxBytes": Buffer.from("0200000001f188a535b6d84aa72396099c067c6906bd60d686cc620a7d0224b305ebd5b20e0000000000ffffffff0122f8029500000000225120ebc1d0b3b872ae37f8d3d35810338e2abfa1b60a36458441db74f9e7a4a79e6100000000", 'hex'),
  //   "spellTxBytes": Buffer.from("02000000000102db86fdad7bb31f1294d8e168eb178edeec383c43d087726daf851c9027db865a0000000000ffffffff5ace6e933240df7d3ccd13bd40bc880d3b3209a9bf5b5609a0c8761611573e760000000000ffffffff03e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e289ef0295000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa000341e4e940c26e3c28c69880ca320921cc3fa0ab638bcd00f0495501520d061e31ae9a341cb1e7b046b1672037a02642cd2188f4f71503a0f5a235ec9ca901f8d1c781fd30040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747383a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a0a101a166616d6f756e741a9502ef89716170705f7075626c69635f696e70757473a283616e982018951118bb18ba1869189c18f918f118bf187f18e91018e21853186a185118d9181a18af182118a918b8184818ca1821185c06189d18c6187618361879982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e66757064617465836174982018951118bb18ba1869189c18f918f118bf187f18e91018e21853186a185118d9181a18af182118a918b8184818ca1821185c06189d18c6187618361879982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e644df7016d696e7499010418a41859184c18591018ca1888182d18bd1833182618340f18bb1836186b1892188518d51842185f1870186f18a4182918c318ea186a185b18a9020318e818ab18ad18f6181c18c5186d189d184c182d181c1836189218821850185518311819182c1718fc186f183418bc18721852188e1853184b182f1825187916189b18f0184309188618f418941891183f181a186918ff186018ef18ac18f3186518e218d91833182918bf18ad18a018d918251857181a182118e91865189b1618e3189f182818ca185418d61318b718bd14186a150a1818183d182a186f18d60918f918891827184a090e185c18e518e018cf1886183118b71318d30c184f186318bb1841188318c3188f181d18eb188a18d618f718f3187918b618c218d318a3182018eb18af18cb18f218a4188d188a18d118c918a418ac18f308188018c4183518db18241885189b186618f6187e1879181b187a189f18ab184918b31820183f18410d18f918b918b118b0182c1846187918a318ce187a00181a18ad18bc189e18a7187218da18d4185b1218b018b01874184e1849188618951898189d1875185218d7185d186318ba188318ed185e18fa0318dd1823183a18b218461820188b185418851873188e1878188a188f186b185518b91889187518ad0c1871186f189018c018a718fd0418f818e318af1818181c6820595a3949bdeef185af34c1a15fe7575108a18023101a7e505f27dfc439329c88ac21c1595a3949bdeef185af34c1a15fe7575108a18023101a7e505f27dfc439329c8800000000", 'hex'),
  // } as Spell;

  const commitmentTransaction = bitcoin.Transaction.fromBuffer(spell.commitmentTxBytes);
  commitmentTransaction.addInput(txidToHash(userPaymenTxid), 0);
  commitmentTransaction.outs[0].value += userPaymentAmount;
  spell.commitmentTxBytes = commitmentTransaction.toBuffer();

  await checkInputsAndOutputs(spell.commitmentTxBytes);

  return spell;
}

export async function signAndTransmitSpell(
  spell: Spell,
  keyPairs: KeyPair[],
  userPaymentDetails: UserPaymentDetails,
  previousNftTxid: string,
  network: Network,
  transmit: boolean): Promise<void> {

  const grailState = await getStateFromNft(previousNftTxid);

  const signedSpell = await prepareSpell(spell, grailState, userPaymentDetails, keyPairs, network);

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

  const spell = await createPegInSpell(
    feeRate, previousNftTxid,
    { publicKeys: currentPublicKeys, threshold: currentThreshold },
    userPaymentTxid,
    { recoveryPublicKey, timelockBlocks },
    userWalletAddress, network);

  await signAndTransmitSpell(
    spell,
    [{ publicKey: Buffer.from(deployerPublicKey, 'hex'), privateKey: Buffer.from(deployerPrivateKey, 'hex') }],
    { recoveryPublicKey, timelockBlocks },
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
