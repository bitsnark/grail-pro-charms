import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, injectGrailSignaturesIntoTxInput, KeyPair } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { showSpell } from '../core/charms-sdk';

import config from './config.json';
import { PegOutRequest } from '../core/types';

export async function createPegOutSpell(
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

  const request: PegOutRequest = {
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
          $01: { action: 'burn' }
        },
        ins: [{
          utxo_id: `${previousNftTxid}:0`,
          charms: {
            $00: {
              ticker: config.ticker,
              current_cosigners: previousPublicKeys.join(','),
              current_threshold: previousThreshold
            },
            $01: {
              amount: this.amount
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
  return spell;
}

export async function signAndTransmitSpell(spell: Buffer[],
  keyPairs: KeyPair[],
  previousNftTxid: string,
  network: Network,
  transmit: boolean): Promise<void> {

  // const spell = ["0200000001c2f5124b16a2d9254ecb0b2418c387808b3c2ab2f30f69d30962f567926287670100000000ffffffff013b77814a00000000225120efb4544742cd92ccedff28d31280805e51eba3ce385b34e1ce12a0615f77d37a00000000","02000000000102c2f5124b16a2d9254ecb0b2418c387808b3c2ab2f30f69d30962f567926287670000000000ffffffff84826f962e5f83fadd4355a33fa8bf5728dd87f36f6cdc17d06b762a821c83920000000000ffffffff03e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa3e6f814a00000000160014235d134597b64c07ebbc2f522eea12e259f2147a00034198380525774f9d6d12881bea7c5cf0e241bb75e8cb4aa6983e7de25f3c458d48ae6c8f7f8b8636720b562e59ddb93c1c86e1fcc2144940139e66e6ab53e36d4581fd3a040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747382a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a101a166616d6f756e741903e8716170705f7075626c69635f696e70757473a283616e9820189518dc189318ab1821189518da183018f9184c185718a318cc189618cc18ba18ca18ba18bc18fa18b3188e183a188318b617188c051893187e182318579820183d0d18a31857186e183518a20118b4189718da1518be18cb1881183c18eb185b184d031873182318b1185b18eb182d18d4184b0d18b418301858a166616374696f6e667570646174658361749820189518dc189318ab1821189518da183018f9184c185718a318cc189618cc18ba18ca18ba18bc18fa18b3188e183a188318b617188c051893187e182318579820183d0d18a31857186e183518a20118b4189718da1518be18cb1881183c18eb185b184d031873182318b1185b18eb182d18d4184b0d18b418301858a1664d0102616374696f6e646d696e7499010418a41859184c1859182b18c7185e181a18c9182c18e9184b183018d518c318b0111893185a0d189818e205182818a20c18b3188918b2189c18af181e18c7189918eb188e1826184c0f18af188318eb187918dc182d18b418ac18a109183e1878188818ab18f1189c18a2186018e8186a18aa1880183a186418d618bb183a18381855182f182e18f61896185018fa1824189418f118c418f9185218ae18e5189d18db18c5186918bc184a18dc187618fc183c188818bd184518e818cd185c186118ca182404189118ec18c01118d81880181b011854189818e81822184918bc1843188c18bc18f318a418bc18d8188f182b1821185418b318d6186c184618fe182b1018c118db185f18fe18a018bd18520418d60d187418ec18471890185003189c186b1850183e187c187d18f118cc1843185618f9184818ed186a04181f186618ca1872186218e918e81839182f1878186118611878181b18de04188318cd18f818c11894189b1843185718f6141018d9185f18b918c9182f18bb182f18ae1884185e141838187e18f1188e184418d118cb18db0218dd18bb18e5182e18ed188f18c9189b0118bc18ab187a186018ab187d13182018c318791823187d18c618f2185b18f018ff18531870186e18b518ab1866182b18bc1871187b18ff188418881870183f18e418ab188e18c1184c18c2183f682093acf557835196244d880e159e020917a12700728b871fa629febc890aa6f427ac21c193acf557835196244d880e159e020917a12700728b871fa629febc890aa6f42700000000"]
  //   .map(hex => Buffer.from(hex, 'hex'));

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

  const labeledSignatures = grailSignTx(
    commitmentTxHex, previousNftTxhex, spellTxhex,
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
      'previous-nft-txid': '6787629267f56209d3690ff3b22a3c8b8087c318240bcb4e25d9a2164b12f5c2',
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
  const deployerPublicKey = argv['deployer-public-key'] as string;
  const deployerPrivateKey = argv['deployer-private-key'] as string;
  const previousNftTxid = argv['previous-nft-txid'] as string;
  const currentPublicKeys = (argv['current-public-keys'] as string).split(',').map(pk => pk.trim());
  const currentThreshold = Number.parseInt(argv['current-threshold']);
  const amuont = Number.parseInt(argv['amount']);
  const userWalletAddress = argv['user-wallet-address'] as string;
  const transmit = !!argv['transmit'];

  const spell = await createPegOutSpell(network, feeRate, previousNftTxid, currentPublicKeys, currentThreshold, amuont, userWalletAddress);
  await signAndTransmitSpell(
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
