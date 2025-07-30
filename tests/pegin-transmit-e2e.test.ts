import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";
import { peginCli } from "../src/cli/pegin";
import { userPaymentCli } from "../src/cli/user-payment";
import { transmitCli } from "../src/cli/transmit";
import { generateBlocks } from "./bitcoin-utils";

jest.setTimeout(600000);

describe('peg-in and transmit e2e test', () => {
  it('should deploy, then peg-in, then transmit successfully', async () => {

    const deployerKaypair = generateRandomKeypair();
    const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
    const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

    console.log('Deployer Public Key:', deployerPublicKey);
    console.log('Deployer Private Key:', deployerPrivateKey);

    console.log('*** Deploying NFT ***');

    const deployResult = await deployNftCli([
      '--deployer-public-key', deployerPublicKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(deployResult).toBeTruthy();
    console.log('Deployment Result:', deployResult);

    console.log('*** User payment ***');

    const newKeypair = generateRandomKeypair();
    const newPublicKey = newKeypair.publicKey.toString('hex');
    const newPrivateKey = newKeypair.privateKey.toString('hex');
    console.log('New Public Key:', newPublicKey);

    const peginAmount = 1000000;

    const userPaymentResult = await userPaymentCli([
      '--current-public-keys', newPublicKey,
      '--current-threshold', '1',
      '--amount', peginAmount.toString(),
      '--network', 'regtest'
    ]);
    expect(userPaymentResult).toBeTruthy();
    console.log('User Payment Result:', userPaymentResult);

    console.log('*** Peg-in ***');

    const peginResult = await peginCli([
      '--app-id', deployResult.appId,
      '--app-vk', deployResult.appVk,
      '--previous-nft-txid', deployResult.spellTxid,
      '--new-public-keys', newPublicKey,
      '--new-threshold', '1',
      '--user-payment-txid', userPaymentResult.txid,
      '--recovery-public-key', userPaymentResult.recoveryPublicKey,
      '--private-keys', [deployerPrivateKey, newPrivateKey].join(','),
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(peginResult).toBeTruthy();
    console.log('Pegin Result:', peginResult);

    console.log('*** Generate a block ***');

    await generateBlocks(1);

    console.log('*** Transmit ***');

    const transmitAmount = 666666;

    const transmitResult = await transmitCli([
      '--app-id', deployResult.appId,
      '--app-vk', deployResult.appVk,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--amount', transmitAmount.toString(),
    ]);
    expect(transmitResult).toBeTruthy();
    console.log('Transmit Result:', transmitResult);
  });
});
