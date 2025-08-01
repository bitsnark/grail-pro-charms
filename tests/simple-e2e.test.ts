import { DEBUG_LEVELS, logger } from '../src/core/logger';
import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";

jest.setTimeout(600000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to 5, print date and level

describe('simple e2e test', () => {
  it('should deploy the NFT', async () => {

    const deployerKaypair = generateRandomKeypair();
    const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
    const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

    logger.log('Deployer Public Key:', deployerPublicKey);
    logger.log('Deployer Private Key:', deployerPrivateKey);

    const result = await deployNftCli([
      '--deployer-public-key', deployerPublicKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(result).toBeTruthy();

    logger.log('Deployment Result:', result);
  });
});
