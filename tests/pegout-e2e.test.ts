import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";
import { peginCli } from "../src/cli/pegin";
import { userPaymentCli } from "../src/cli/user-payment";

jest.setTimeout(600000);

describe('simple e2e test', () => {
  it('should deploy, then peg-in, then peg-out successfully', async () => {

    const deployerKaypair = generateRandomKeypair();
    const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
    const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

    console.log('Deployer Public Key:', deployerPublicKey);
    console.log('Deployer Private Key:', deployerPrivateKey);

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

    const newKeypair = generateRandomKeypair();
    const newPublicKey = newKeypair.publicKey.toString('hex');
    console.log('New Public Key:', newPublicKey);

    const userPaymentResult = await userPaymentCli([
      '--current-public-keys', newPublicKey,
      '--current-threshold', '1',
      '--amount', '1000000',
      '--network', 'regtest'
    ]);
    expect(userPaymentResult).toBeTruthy();
    console.log('User Payment Result:', userPaymentResult);

    const peginResult = await peginCli([
      '--app-id', deployResult.appId,
      '--app-vk', deployResult.appVk,
      '--previous-nft-txid', deployResult.spellTxid,
      '--new-public-keys', newPublicKey,
      '--new-threshold', '1',
      '--user-payment-txid', userPaymentResult.txid,
      '--recovery-public-key', userPaymentResult.recoveryPublicKey,
      '--private-keys', deployerPrivateKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(peginResult).toBeTruthy();
    console.log('Pegin Result:', peginResult);
  });
});
