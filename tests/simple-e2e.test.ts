import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";
import { userPaymentCli } from "../src/cli/user-payment";
import { peginCli } from "../src/cli/pegin";

jest.setTimeout(600000);

describe('simple e2e test', () => {
  it('should deploy the NFT', async () => {

    // Generate a random keypair for the deployer
    const deployerKaypair = generateRandomKeypair();
    const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
    const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

    console.log('Deployer Public Key:', deployerPublicKey);
    console.log('Deployer Private Key:', deployerPrivateKey);

    // Deploy the NFT using the CLI
    const result = await deployNftCli([
      '--deployer-public-key', deployerPublicKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(result).toBeTruthy();
    console.log('Deployment Result:', result);

    // Execute user payment
    const paymentResult = await userPaymentCli([
      '--current-public-keys', deployerPublicKey,
      '--current-threshold', '1',
      '--amount', '666666'
    ]);
    expect(paymentResult).toBeTruthy();
    console.log('User Payment Result:', paymentResult);

    // Execute peg in
    const peginResult = await peginCli([
      '--app-id', result.appId,
      '--app-vk', result.appVk,
      '--new-public-keys', deployerPublicKey,
      '--new-threshold', '1',
      '--previous-nft-txid', result.spellTxid,
      '--recovery-public-key', paymentResult.recoveryPublicKey,
      '--private-keys', deployerPrivateKey,
      '--user-payment-txid', paymentResult.txid,
      '--mock-proof', 'true',
      '--transmit', 'true'
    ]);
    expect(peginResult).toBeTruthy();
    console.log('Pegin Result:', peginResult);
  });
});
