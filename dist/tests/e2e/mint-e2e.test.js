"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../src/core/logger");
const generate_random_keypairs_1 = require("../../src/cli/generate-random-keypairs");
const deploy_1 = require("../../src/cli/deploy");
const mint_1 = require("../../src/cli/mint");
jest.setTimeout(600000000);
logger_1.logger.setLoggerOptions(logger_1.DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level
const USE_MOCK_PROOF = 'true'; // Use mock proof for testing
logger_1.logger.warn(`Using mock proof: ${USE_MOCK_PROOF}.`);
describe('mint e2e test', () => {
    it('should deploy, then mint successfully', async () => {
        const deployerKaypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
        const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
        const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');
        logger_1.logger.log('Deployer Public Key: ', deployerPublicKey);
        logger_1.logger.log('Deployer Private Key: ', deployerPrivateKey);
        logger_1.logger.log('*** Deploying NFT ***');
        const deployResult = await (0, deploy_1.deployNftCli)([
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
        logger_1.logger.log('Deployment Result: ', deployResult);
        logger_1.logger.log('*** User payment ***');
        const mintAmount = 666666;
        logger_1.logger.log('*** Mint ***');
        const mintResult = await (0, mint_1.mintCli)([
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
        logger_1.logger.log('Mint Result: ', mintResult);
    });
});
