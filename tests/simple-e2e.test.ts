import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";

jest.setTimeout(600000);

describe('simple e2e test', () => {
  it('should deploy the NFT', async () => {

    const deployerKaypair = generateRandomKeypair();
    const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
    const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

    console.log('Deployer Public Key:', deployerPublicKey);
    console.log('Deployer Private Key:', deployerPrivateKey);

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
  });
});
