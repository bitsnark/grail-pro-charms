import { DEBUG_LEVELS, logger } from '../src/core/logger';
import { generateRandomKeypair } from '../src/cli/generate-random-keypairs';
import { deployNftCli } from '../src/cli/deploy';
import { mintCli } from '../src/cli/mint';

jest.setTimeout(600000000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level

const USE_MOCK_PROOF = 'true'; // Use mock proof for testing
logger.warn(`Using mock proof: ${USE_MOCK_PROOF}.`);

describe('mint e2e test', () => {
	it('should deploy, then mint successfully', async () => {
		const deployerKaypair = generateRandomKeypair();
		const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
		const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

		logger.log('Deployer Public Key: ', deployerPublicKey);
		logger.log('Deployer Private Key: ', deployerPrivateKey);

		logger.log('*** Deploying NFT ***');

		const deployResult = await deployNftCli([
			'--deployer-public-key',
			deployerPublicKey,
			'--mock-proof',
			USE_MOCK_PROOF,
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--ticker',
			'TESTNFT',
		]);
		expect(deployResult).toBeTruthy();
		logger.log('Deployment Result: ', deployResult);

		logger.log('*** User payment ***');

		const mintAmount = 666666;

		logger.log('*** Mint ***');

		const mintResult = await mintCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--previous-nft-txid',
			deployResult.spellTxid,
			'--private-keys',
			[deployerPrivateKey].join(','),
			'--mock-proof',
			USE_MOCK_PROOF,
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--ticker',
			'TESTNFT',
			'--amount',
			mintAmount.toString(),
		]);
		expect(mintResult).toBeTruthy();
		logger.log('Mint Result: ', mintResult);
	});
});
