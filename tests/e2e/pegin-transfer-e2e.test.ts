import { generateRandomKeypair } from '../../src/cli/generate-random-keypairs';
import { deployNftCli } from '../../src/cli/deploy';
import { peginCli } from '../../src/cli/pegin';
import { userPaymentCli } from '../../src/cli/user-payment';
import { DEBUG_LEVELS, logger } from '../../src/core/logger';
import { generateBlocks } from './bitcoin-utils';
import { transferCli } from '../../src/cli/transfer';

jest.setTimeout(600000000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level

describe('peg-in and transfer e2e test', () => {
	it('should deploy, then peg-in, then transfer successfully', async () => {
		const deployerKaypair = generateRandomKeypair();
		const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
		const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

		logger.log('Deployer Public Key:', deployerPublicKey);
		logger.log('Deployer Private Key:', deployerPrivateKey);

		logger.log('*** Deploying NFT ***');

		const deployResult = await deployNftCli([
			'--deployer-public-key',
			deployerPublicKey,
			'--mock-proof',
			'true',
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--ticker',
			'TESTNFT',
			'--skip-proof',
			'true',
		]);
		expect(deployResult).toBeTruthy();
		logger.log('Deployment Result:', deployResult);

		logger.log('*** User payment ***');

		const newKeypair = generateRandomKeypair();
		const newPublicKey = newKeypair.publicKey.toString('hex');
		const newPrivateKey = newKeypair.privateKey.toString('hex');
		logger.log('New Public Key:', newPublicKey);

		const peginAmount = 1000000;

		const userPaymentResult = await userPaymentCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--type',
			'btc',
			'--current-public-keys',
			newPublicKey,
			'--current-threshold',
			'1',
			'--amount',
			peginAmount.toString(),
			'--network',
			'regtest',
		]);
		expect(userPaymentResult).toBeTruthy();
		logger.log('User Payment Result:', userPaymentResult);

		logger.log('*** Peg-in ***');

		const peginResult = await peginCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--previous-nft-txid',
			deployResult.spellTxid,
			'--new-public-keys',
			newPublicKey,
			'--new-threshold',
			'1',
			'--user-payment-txid',
			userPaymentResult.txid,
			'--recovery-public-key',
			userPaymentResult.recoveryPublicKey,
			'--private-keys',
			[deployerPrivateKey, newPrivateKey].join(','),
			'--mock-proof',
			'true',
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--ticker',
			'TESTNFT',
			'--skip-proof',
			'true',
		]);
		expect(peginResult).toBeTruthy();
		logger.log('Pegin Result:', peginResult);

		logger.log('*** Generate a block ***');

		await generateBlocks(1);

		logger.log('*** transfer ***');

		const transmitAmount = 666666;

		const transferResult = await transferCli([
			'--app-id',
			deployResult.appId,
			'--app-vk',
			deployResult.appVk,
			'--mock-proof',
			'true',
			'--network',
			'regtest',
			'--feerate',
			'0.00002',
			'--transmit',
			'true',
			'--amount',
			transmitAmount.toString(),
			'--skip-proof',
			'false',
		]);
		expect(transferResult).toBeTruthy();
		logger.log('Transfer Result:', transferResult);
	});
});
