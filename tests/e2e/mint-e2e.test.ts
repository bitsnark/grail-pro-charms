import { DEBUG_LEVELS, logger } from '../../src/core/logger';
import { mintCli } from '../../src/cli/mint';
import { deployNftCli } from '../../src/cli/deploy';

jest.setTimeout(600000000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level

describe('mint e2e test', () => {
	it('should deploy, then mint successfully', async () => {
		const deployerPublicKey =
			'52d8f3bcb43c926eac49da429884d85f8299d807821dee4d4ef008c5dec69170';
		const deployerPrivateKey =
			'35b49ca966cfbffd592eed5e25931862603dcc5a7c2d5378049aa92152fa0d9b';

		logger.log('Deployer Public Key: ', deployerPublicKey);
		logger.log('Deployer Private Key: ', deployerPrivateKey);

		logger.log('*** Deploying NFT ***');

		const deployResult = await deployNftCli([
			'--deployer-public-key',
			deployerPublicKey,
			'--mock-proof',
			'false',
			'--network',
			'mainnnet',
			'--feerate',
			'0.00000004',
			'--transmit',
			'true',
			'--ticker',
			'zkBTC',
			'--token-name',
			'BOS zkBTC',
			'--token-image',
			'https://bitcoinos.build/images/logo-dark.png',
			'--token-url',
			'https://bitcoinos.build/zkbtc',
		]);
		expect(deployResult).toBeTruthy();
		logger.log('Deployment Result: ', deployResult);

		// const deployResult = {
		// 	appId: '02c462f8a3fadebf76ffd864ee17974bfe2df2f558dd04445ac1e0b4d570059c',
		// 	appVk: 'd0c90877df715c3be2d6b143953c5064f8f39f2745e2b1517712e83ba7548a03',
		// 	spellTxid:
		// 		'ecef3abe297a57fb5393abf4c59ceab89fb1d8db7e9b81e10e55c1f2e357da12',
		// };

		const mintAmount = 9000000000;

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
			'false',
			'--network',
			'mainnnet',
			'--feerate',
			'0.00000004',
			'--transmit',
			'true',
			'--amount',
			mintAmount.toString(),
			'--ticker',
			'zkBTC',
			'--token-name',
			'BOS zkBTC',
			'--token-image',
			'https://bitcoinos.build/images/logo-dark.png',
			'--token-url',
			'https://bitcoinos.build/zkbtc',
		]);
		expect(mintResult).toBeTruthy();
		logger.log('Mint Result: ', mintResult);
	});
});
