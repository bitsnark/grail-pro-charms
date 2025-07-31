import { generateRandomKeypair } from '../src/cli/generate-random-keypairs';
import { deployNftCli } from '../src/cli/deploy';
import { peginCli } from '../src/cli/pegin';
import { userPaymentCli } from '../src/cli/user-payment';
import { pegoutCli } from '../src/cli/pegout';
import { generateBlocks } from './bitcoin-utils';

jest.setTimeout(600000);

describe('peg-in and peg-out e2e test', () => {
	it('should deploy, then peg-in, then transmit successfully', async () => {
		const deployerKaypair = generateRandomKeypair();
		const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
		const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');

		console.log('Deployer Public Key:', deployerPublicKey);
		console.log('Deployer Private Key:', deployerPrivateKey);

		console.log('*** Deploying NFT ***');

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
		]);
		expect(deployResult).toBeTruthy();
		console.log('Deployment Result:', deployResult);

		console.log('*** User payment ***');

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
		console.log('User Payment Result:', userPaymentResult);

		console.log('*** Peg-in ***');

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
			'true',
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
		console.log('Pegin Result:', peginResult);

		console.log('*** Generate a block ***');

		await generateBlocks(1);

		console.log('*** User payment ***');

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
			'true',
		]);
		expect(charmsUserPaymentResult).toBeTruthy();
		console.log('Charms User Payment Result:', charmsUserPaymentResult);

		console.log('*** Peg-out ***');

		const pegoutResult = await pegoutCli([
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
		console.log('Pegout Result:', pegoutResult);
	});
});
