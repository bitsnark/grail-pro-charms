import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, KeyPair } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { PegInRequest } from '../core/types';
import { showSpell } from '../core/charms-sdk';
import * as bitcoin from 'bitcoinjs-lib';
import { getStateFromNft, prepareSpell } from './utils/signing';

import config from './config.json';

export async function createPegInSpell(
  feeRate: number,
  previousNftTxid: string,
  currentPublicKeys: string[],
  currentThreshold: number,
  amount: number,
  userPaymenTxid: string,
  userWalletAddress: string,
  network: Network
): Promise<[Buffer, Buffer]> {

  const bitcoinClient = await BitcoinClient.create();

  const previousNftTxhex = await bitcoinClient.getTransactionHex(previousNftTxid);
  if (!previousNftTxhex) {
    throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
  }

  const grailAddress = generateGrailPaymentAddress(currentPublicKeys, currentThreshold, network);
  const fundingChangeAddress = await bitcoinClient.getAddress();
  const fundingUtxo = await bitcoinClient.getFundingUtxo();

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

  const commitmentTransaction = bitcoin.Transaction.fromHex(spell[0].toString('hex'));
  commitmentTransaction.addInput(Buffer.from(userPaymenTxid, 'hex').reverse(), 0);

  spell[1] = commitmentTransaction.toBuffer();

  return spell;
}

export async function signAndTransmitSpell(
  spell: [Buffer, Buffer],
  keyPairs: KeyPair[],
  recoveryPublicKey: string,
  timeoutBlocks: number,
  previousNftTxid: string,
  network: Network,
  transmit: boolean): Promise<void> {

  const { publicKeys, threshold } = await getStateFromNft(previousNftTxid);

  const signedSpell = await prepareSpell(spell, publicKeys, threshold, recoveryPublicKey, timeoutBlocks, keyPairs, network);

  console.log('Signed spell:', signedSpell.map(buf => buf.toString('hex')));

  if (transmit) {
    const bitcoinClient = await BitcoinClient.create();
    console.info('Transmitting...');
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
      'previous-nft-txid': 'dd21e6ea2c31947e8dfa734248c1e3d91d55d4218ad0307272b47c3d23bc5165',
      'current-public-keys': `ff61e0fc3b753acb4c32943452d09b8f6d1e58a05e9ee140d7e76441aab70c4c,${config.deployerPublicKey}`,
      'current-threshold': 1,
      'user-payment-txid': 'feae719114bd9245b61eea581119a39ecc29c94bb371293d1b635506c4eb785b',
      'recovery-public-key': '3714a4cec4745378a5889eb8964a08ba73f146ddcf150f8d9cd565f9e7c8f530',
      'timeout-blocks': 10,
      'amount': 666666,
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
  const amount = Number.parseInt(argv['amount']);
  const recoveryPublicKey = argv['recovery-public-key'] as string;
  const timeoutBlocks = Number.parseInt(argv['timeout-blocks']);
  const userWalletAddress = argv['user-wallet-address'] as string;
  const userPaymentTxid = argv['user-payment-txid'] as string;
  const transmit = !!argv['transmit'];

  const spell = await createPegInSpell(
    feeRate, previousNftTxid,
    currentPublicKeys, currentThreshold, amount,
    userPaymentTxid, userWalletAddress, network);

  // const spell = [
  //   '0200000001fc5224f403cb797e4072ee9e5b613654956c0a6486a821260f7500ff23de5f5a0000000000ffffffff01a27b814a00000000225120b6669677ef0ca259287c83a9d2d17e0b9526a8128dfcb28f3778f15421cb923400000000',
  //   '020000000001026551bc233d7cb4727230d08a21d4551dd9e3c1484273fa8d7e94312ceae621dd0000000000ffffffff0f014386b792770b404120c041d23d6920dc55fd8476a06acf6a0699b50726b20000000000ffffffff04e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e22a2c0a00000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa2d47774a0000000016001447655be49fcdfe6134d036db4a02d4c44e047f7700034151bb06c8a983c68df9fc57aa3fd19d0c3565c7eae472d8c11533fc1b622871bf80c47871806fc51386df40d04e2a59e9664fa69af61d6189476417b6053e471081fd2a040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747383a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a0a101a166616d6f756e741a000a2c2a716170705f7075626c69635f696e70757473a283616e98200518f9186a185217187a187a18f718ae18d818a418bc18641825188d184018d318b3184718b8185f18e318cc18b2183018f718d40a183318a8188518cb982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e6675706461746583617498200518f9186a185217187a187a18f718ae18d818a418bc18641825188d184018d318b3184718b8185f18e318cc18b2183018f718d40a183318a8188518cb982018f418e1091831189618f3181f0f188e18be1856183c1880186018940a18271871181e170218d808184a181c14182c0718f318ab12182da166616374696f6e644df1016d696e7499010418a41859184c18590618681885189b182518f618911860186c18ac18d218be18a51859183518fc18851829188118f9186d182018ec188618460b1820184f1887182018f818ac182d182418a2189a187f18e618ca185c1846188218fd1825187e18831832188318f2184a188f18fc18b8186f185c18db182618dc188011187b18651418ce091859185f18e118a618d4181e181b1849188f189405188e18c418f81820187a186d186818d7184b18f5185c18d21885184b183b1870189518c818c11866182e0018e518f2186a1828188b187318891840188118ff18f618ba183b18b018af184918a0184618e618bf186318ee0b0e1842187918e91867188b18f8182518f4188e184d18e118ae18cf0c18481884186018bb0a18fa183218ea185d18f218f71885189618d0186718a80b183e18a618260118551829101218630b18221856186b181b18b418a9181f18f918ce18701868185318d2181a187f18b00218db18fe0118d818390e18d1184218ce04189a0107001884185a18be18ae183d18dc186b18da18dd182818cc188418a818dc187a18a61819188118aa185d18f018b318ef18f118b9187c18d118ce184b18da0c1890188e0e185418a514184218fd184e18ca18471882188b18a5189f001818091835189518e0185b1855161018f718321890185818c01882682007e297cf4083012c6da6de32c0821c83967d7215cd10eded2644aad77b4c5261ac21c007e297cf4083012c6da6de32c0821c83967d7215cd10eded2644aad77b4c526100000000'
  // ].map(hex => Buffer.from(hex, 'hex')) as [Buffer, Buffer];

  await signAndTransmitSpell(
    spell,
    [{ publicKey: Buffer.from(deployerPublicKey, 'hex'), privateKey: Buffer.from(deployerPrivateKey, 'hex') }],
    recoveryPublicKey,
    timeoutBlocks,
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
