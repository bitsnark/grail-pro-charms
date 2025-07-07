import minimist from 'minimist';
import { BitcoinClient } from '../core/bitcoin';
import { createSpell, transmitSpell } from '../core/spells';
import { generateGrailPaymentAddress, grailSignTx, injectGrailSignaturesIntoTxInput } from '../core/taproot';
import { Network } from '../core/taproot/taptree';
import { MintRequest } from '../core/types';
import { showSpell } from '../core/charms-sdk';

import config from './config.json';

export async function mintToken(
  network: Network,
  feeRate: number,
  previousNftTxid: string,
  currentPublicKeys: string[],
  currentThreshold: number,
  amount: number,
  userWalletAddress: string,
  deployerPublicKey: string,
  deployerPrivateKey: string,
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

  const previousPublicKeys = previousSpellData.outs[0].charms['$0000'].current_cosigners.split(',');
  const previousThreshold = previousSpellData.outs[0].charms['$0000'].current_threshold;

  const request: MintRequest = {
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

  // const spell = await createSpell(bitcoinClient, [previousNftTxid], request);

  const spell = ["02000000015f4e9e8fb17207bf5513741db26177213e8b4a494abdc168d11f993f54abde620100000000ffffffff01306c814a00000000225120b5c6a53295a9b11b0675a8913ee1dadbc5a3c1d34119c9a53e69d5d2e808e69300000000","02000000000102d7cfe3d3b46472b236cac8f9be3703b4faab7d0d5fa27916ab402e42401e54660000000000ffffffffe8c79bd2a3e65c5747f7c2312b8719316092449331c017c70f42182372cbbe410000000000ffffffff03e8030000000000002251205afec6d38f99b81d705510fc0ac4832e9b02296b9ef16af760378af66fa3a3e2e8030000000000001600140c2ba5242064097fe376ac41be7c892a7abec8fa2b64814a00000000160014eff6d25263a0f90992012313f2edb52f79b8f1d900034125322ccd375fce026ea86855f91ec7078ccada788502fff046e6fb33aef1b7e72d5ae35e229518743231e5bba61969c1bb487b0a6e4d40c2ce691efb8165c46381fd49040063057370656c6c4d080282a36776657273696f6e04627478a2647265667380646f75747382a100a3667469636b657269475241494c2d4e46547163757272656e745f636f7369676e6572737881666636316530666333623735336163623463333239343334353264303962386636643165353861303565396565313430643765373634343161616237306334632c623935353532613666613631656135363137316536653236306364626135376432353062343462613132333464633932386131373736393866336630313664617163757272656e745f7468726573686f6c6401a101a166616d6f756e741903e8716170705f7075626c69635f696e70757473a283616e982018d1185418b218f4187618ee183018df18c918a418c6189718aa18371848184d187318f718a918e618ca183818d11840183618c418c418c218a9181b18fb18d0982018a018df1838183218bb182718be184c182c18fe1840183418a9184818cd1843186a181e18f3187118bb188e18771849185818df18b5184118b718e81892181ba166616374696f6e66757064617465836174982018d1185418b218f4187618ee183018df18c918a418c6189718aa18371848184d187318f718a918e618ca183818d11840183618c418c418c218a9181b18fb18d0982018a018df1838183218bb182718be184c182c18fe1840183418a9184818cd1843186a181e18f3187118bb188e18771849185818df4d080218b5184118b718e81892181ba166616374696f6e646d696e7499010418a41859184c1859182e186d18d618a7183f18ea186d185b18d61848187118b1182618d5182418851818187c183a183d1843183f18fc18c818a91827187c183118ad18e9041853182218a7182b18e318b718ed18ee183c18d518ba18a31835185418a318e2188e181d187e18a516188a184518b1183a1871184a188f0d18df1833182718960e18ec18c018f018e3188518fe1866186b18bb181e182518a4188e182318f4186e182018db1823185f1848188818e018681863186a189418c518ae186518d305189a1862186a18cb186b1830189018ce183d182c181c1837185a1827188b18a018fa183818e6187d1897182d182000188e182d18f30518a71864185600186e09184418c418e6184b18a0189418cf18e618e518da0018ad18a818761836182e1850186f18a218ed1844186718430318ba18bf18b9186b091818186e183b186e18e01844184418ee18cf18f018de18e118cf18851862188d1866186a18fc18961879184218ed18ee18c718d318fa18d8188d1890183d18e706187418e118180f187518c0189d184518c9181a1894187f184118811858189d186518da186d18a518de18f01854188c1821186218d112183118e90e17185118fd18a418f418701865185901188e18a2188d0618631872188718ba184e18a518f818861875182e1840188118fd18d71807dc183a0718da136820b740c2b58e97c12f1bb015022d228734ad7673d47079080d8f692dc9cfd55a38ac21c0b740c2b58e97c12f1bb015022d228734ad7673d47079080d8f692dc9cfd55a3800000000"]
    .map(hex => Buffer.from(hex, 'hex'));

  if (!spell || spell.length !== 2) {
    throw new Error('Spell creation failed');
  }
  const commitmentTxHex = spell[0].toString('hex');
  const spellTxhex = spell[1].toString('hex');

  const labeledSignatures = grailSignTx(
    commitmentTxHex, previousNftTxhex, spellTxhex, previousPublicKeys, previousThreshold,
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
      'previous-nft-txid': '66541e40422e40ab1679a25f0d7dabfab40337bef9c8ca36b27264b4d3e3cfd7',
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

  await mintToken(network, feeRate, previousNftTxid, currentPublicKeys, currentThreshold,
    amuont, userWalletAddress, deployerPublicKey, deployerPrivateKey, transmit);
  console.log('NFT update completed successfully');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error during NFT update:', error);
  });
}
