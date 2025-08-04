import { DEBUG_LEVELS, logger } from '../src/core/logger';
import { generateRandomKeypair } from '../src/cli/generate-random-keypairs';
import { deployNftCli } from '../src/cli/deploy';
import { peginCli } from '../src/cli/pegin';
import { userPaymentCli } from '../src/cli/user-payment';
import { pegoutCli } from '../src/cli/pegout';
import { generateBlocks } from './bitcoin-utils';

jest.setTimeout(600000000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level

const USE_MOCK_PROOF = 'true'; // Use mock proof for testing
logger.warn(`Using mock proof: ${USE_MOCK_PROOF}.`);

describe('peg-in and peg-out e2e test', () => {
	it('should deploy, then peg-in, then transmit successfully', async () => {
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

		const peginAmount = 1000000;

		const userPaymentResult = await userPaymentCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--type',
			'btc',
			'--current-public-keys',
			deployerPublicKey,
			'--current-threshold',
			'1',
			'--amount',
			peginAmount.toString(),
			'--network',
			'regtest',
		]);
		expect(userPaymentResult).toBeTruthy();
		logger.log('User Payment Result: ', userPaymentResult);

		logger.log('*** Peg-in ***');

		const peginResult = await peginCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--previous-nft-txid',
			deployResult.spellTxid,
			'--new-public-keys',
			deployerPublicKey,
			'--new-threshold',
			'1',
			'--user-payment-txid',
			userPaymentResult.txid,
			'--recovery-public-key',
			userPaymentResult.recoveryPublicKey,
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
		]);
		expect(peginResult).toBeTruthy();
		logger.log('Pegin Result: ', peginResult);

		logger.log('*** Generate a block ***');

		await generateBlocks(1);

		logger.log('*** User payment ***');

		const pegoutAmount = 666666;

		const charmsUserPaymentResult = await userPaymentCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--type',
			'charms',
			'--current-public-keys',
			deployerPublicKey,
			'--current-threshold',
			'1',
			'--amount',
			pegoutAmount.toString(),
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--mock-proof',
			USE_MOCK_PROOF,
		]);
		expect(charmsUserPaymentResult).toBeTruthy();
		logger.log('Charms User Payment Result: ', charmsUserPaymentResult);

		logger.log('*** Peg-out ***');

		const pegoutResult = await pegoutCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--mock-proof',
			USE_MOCK_PROOF,
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--amount',
			pegoutAmount.toString(),
			'--previous-nft-txid',
			peginResult[1],
			'--new-public-keys',
			deployerPublicKey,
			'--new-threshold',
			'1',
			'--private-keys',
			[deployerPrivateKey].join(','),
			'--user-payment-txid',
			charmsUserPaymentResult.txid,
			'--recovery-public-key',
			charmsUserPaymentResult.recoveryPublicKey,
			'--ticker',
			'TESTNFT',
		]);
		expect(pegoutResult).toBeTruthy();
		logger.log('Pegout Result:', pegoutResult);
	});
});
