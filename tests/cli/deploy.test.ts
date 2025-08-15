/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateRandomKeypair } from '../../src/cli/generate-random-keypairs';
import { deployNftCli } from '../../src/cli/deploy';
import { BitcoinClient } from '../../src/core/bitcoin';

jest.setTimeout(1200000);

describe('deploy e2e test', () => {
	let deployerPublicKey: string;
	let deployerPrivateKey: string;
	let deploymentResult: any;

	it('should generate random keypair for deployer', async () => {
		// Generate a random keypair for the deployer
		const deployerKeypair = generateRandomKeypair();
		deployerPublicKey = deployerKeypair.publicKey.toString('hex');
		deployerPrivateKey = deployerKeypair.privateKey.toString('hex');

		console.log('Deployer Public Key:', deployerPublicKey);
		console.log('Deployer Private Key:', deployerPrivateKey);

		expect(deployerPublicKey).toBeDefined();
		expect(deployerPrivateKey).toBeDefined();
		expect(deployerPublicKey.length).toBeGreaterThan(0);
		expect(deployerPrivateKey.length).toBeGreaterThan(0);
	});

	it('should deploy the NFT successfully', async () => {
		expect(deployerPublicKey).toBeDefined();

		// Deploy the NFT using the CLI
		deploymentResult = await deployNftCli([
			'--deployer-public-key', deployerPublicKey,
			'--mock-proof', 'true',
			'--network', 'regtest',
			'--feerate', '0.00002',
			'--transmit', 'true',
			'--ticker', 'TESTNFT',
		]);

		// Verify deployment result structure
		expect(deploymentResult).toBeTruthy();
		expect(deploymentResult.appId).toBeDefined();
		expect(deploymentResult.appVk).toBeDefined();
		expect(deploymentResult.spellTxid).toBeDefined();

		// Verify data types and formats
		expect(typeof deploymentResult.appId).toBe('string');
		expect(typeof deploymentResult.appVk).toBe('string');
		expect(typeof deploymentResult.spellTxid).toBe('string');
		expect(deploymentResult.appId.length).toBeGreaterThan(0);
		expect(deploymentResult.appVk.length).toBeGreaterThan(0);
		expect(deploymentResult.spellTxid.length).toBeGreaterThan(0);

		console.log('Deployment Result:', deploymentResult);
	});

	it('should verify deployment with blockchain confirmation', async () => {
		expect(deploymentResult).toBeDefined();
		expect(deploymentResult.spellTxid).toBeDefined();

		// Initialize Bitcoin client to verify the transaction
		const bitcoinClient = await BitcoinClient.initialize();

		// Get transaction hex to verify it exists on the blockchain
		const txHex = await bitcoinClient.getTransactionHex(
			deploymentResult.spellTxid
		);
		expect(txHex).toBeDefined();
		expect(typeof txHex).toBe('string');
		expect(txHex.length).toBeGreaterThan(0);

		console.log(
			'Transaction verified on blockchain:',
			deploymentResult.spellTxid
		);
	});

	it('should mint a block to confirm deployment', async () => {
		// Mint a block in regtest to confirm the deployment transaction
		const bitcoinClient = await BitcoinClient.initialize();
		const address = await bitcoinClient.getAddress();
		const blockHashes = await bitcoinClient.generateToAddress(1, address);

		expect(blockHashes).toBeDefined();
		expect(blockHashes.length).toBe(1);
		expect(blockHashes[0]).toBeDefined();
		expect(typeof blockHashes[0]).toBe('string');
		expect(blockHashes[0].length).toBeGreaterThan(0);

		console.log('Minted block to confirm deployment:', blockHashes[0]);
	});
});
