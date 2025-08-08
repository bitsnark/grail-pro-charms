"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const logger_1 = require("../../src/core/logger");
const generate_random_keypairs_1 = require("../../src/cli/generate-random-keypairs");
const deploy_1 = require("../../src/cli/deploy");
const user_payment_1 = require("../../src/cli/user-payment");
const pegin_1 = require("../../src/cli/pegin");
const bitcoin_1 = require("../../src/core/bitcoin");
jest.setTimeout(600000000);
logger_1.logger.setLoggerOptions(logger_1.DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level
describe('simple e2e test', () => {
    let deployerPublicKey;
    let deployerPrivateKey;
    let deploymentResult;
    let paymentResult;
    beforeAll(() => {
        logger_1.logger.log('Starting simple e2e test...');
        const deployerKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
        deployerPublicKey = deployerKeypair.publicKey.toString('hex');
        deployerPrivateKey = deployerKeypair.privateKey.toString('hex');
        logger_1.logger.log('Deployer Public Key:', deployerPublicKey);
        logger_1.logger.log('Deployer Private Key:', deployerPrivateKey);
    });
    it('should deploy the NFT', async () => {
        expect(deployerPublicKey).toBeDefined();
        // Deploy the NFT using the CLI
        deploymentResult = await (0, deploy_1.deployNftCli)([
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
        paymentResult = await (0, user_payment_1.userPaymentCli)([
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
        const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
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
        const peginResult = await (0, pegin_1.peginCli)([
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
