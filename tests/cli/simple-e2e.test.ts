import { DEBUG_LEVELS, logger } from '../../src/core/logger';
import { generateRandomKeypair } from '../../src/cli/generate-random-keypairs';
import { deployNftCli } from '../../src/cli/deploy';
import { userPaymentCli } from '../../src/cli/user-payment';
import { peginCli } from '../../src/cli/pegin';
import { BitcoinClient } from '../../src/core/bitcoin';

jest.setTimeout(600000000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level

describe('simple e2e test', () => {
	let deployerPublicKey: string;
	let deployerPrivateKey: string;
	let deploymentResult: any;
	let paymentResult: any;

	beforeAll(() => {
		logger.log('Starting simple e2e test...');
		const deployerKeypair = generateRandomKeypair();
		deployerPublicKey = deployerKeypair.publicKey.toString('hex');
		deployerPrivateKey = deployerKeypair.privateKey.toString('hex');

		logger.log('Deployer Public Key:', deployerPublicKey);
		logger.log('Deployer Private Key:', deployerPrivateKey);
	});

	it('should deploy the NFT', async () => {
		expect(deployerPublicKey).toBeDefined();

    // Deploy the NFT using the CLI
    deploymentResult = await deployNftCli([
      '--deployer-public-key', deployerPublicKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);
    expect(deploymentResult).toBeTruthy();
    expect(deploymentResult.appId).toBeDefined();
    expect(deploymentResult.appVk).toBeDefined(); 
    expect(deploymentResult.spellTxid).toBeDefined();
    console.log('Deployment Result:', deploymentResult);
  });

	it('should execute user payment', async () => {
		expect(deployerPublicKey).toBeDefined();
		expect(deploymentResult).toBeDefined();

		// Execute user payment
		paymentResult = await userPaymentCli([
			'--type',
			'btc',
			'--app-id',
			deploymentResult.appId,
			'--app-vk',
			deploymentResult.appVk,
			'--current-public-keys',
			deployerPublicKey,
			'--current-threshold',
			'1',
			'--amount',
			'666666',
		]);
		expect(paymentResult).toBeTruthy();
		expect(paymentResult.txid).toBeDefined();
		expect(paymentResult.recoveryPublicKey).toBeDefined();
		console.log('User Payment Result:', paymentResult);
	});

	it('should mint a block in regtest', async () => {
		// Mint a block in regtest
		const bitcoinClient = await BitcoinClient.initialize();
		const address = await bitcoinClient.getAddress();
		const blockHashes = await bitcoinClient.generateToAddress(1, address);

		expect(blockHashes).toBeDefined();
		expect(blockHashes.length).toBe(1);
		expect(blockHashes[0]).toBeDefined();
		console.log('Minted block:', blockHashes[0]);
	});

	it('should execute pegin', async () => {
		expect(deploymentResult).toBeDefined();
		expect(paymentResult).toBeDefined();
		expect(deployerPublicKey).toBeDefined();
		expect(deployerPrivateKey).toBeDefined();

		// Execute peg in
		const peginResult = await peginCli([
			'--app-id',
			deploymentResult.appId,
			'--app-vk',
			deploymentResult.appVk,
			'--new-public-keys',
			deployerPublicKey,
			'--new-threshold',
			'1',
			'--previous-nft-txid',
			deploymentResult.spellTxid,
			'--recovery-public-key',
			paymentResult.recoveryPublicKey,
			'--private-keys',
			deployerPrivateKey,
			'--user-payment-txid',
			paymentResult.txid,
			'--mock-proof',
			'true',
			'--transmit',
			'true',
		]);
		expect(peginResult).toBeTruthy();
		console.log('Pegin Result:', peginResult);
	});
});
