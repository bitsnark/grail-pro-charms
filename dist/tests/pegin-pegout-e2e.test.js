"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../src/core/logger");
const generate_random_keypairs_1 = require("../src/cli/generate-random-keypairs");
const deploy_1 = require("../src/cli/deploy");
const pegin_1 = require("../src/cli/pegin");
const user_payment_1 = require("../src/cli/user-payment");
const pegout_1 = require("../src/cli/pegout");
const bitcoin_utils_1 = require("./bitcoin-utils");
jest.setTimeout(600000000);
logger_1.logger.setLoggerOptions(logger_1.DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level
const USE_MOCK_PROOF = 'true'; // Use mock proof for testing
logger_1.logger.warn(`Using mock proof: ${USE_MOCK_PROOF}.`);
describe('peg-in and peg-out e2e test', () => {
    it('should deploy, then peg-in, then transmit successfully', async () => {
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
        const peginAmount = 1000000;
        const userPaymentResult = await (0, user_payment_1.userPaymentCli)([
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
        logger_1.logger.log('User Payment Result: ', userPaymentResult);
        logger_1.logger.log('*** Peg-in ***');
        const peginResult = await (0, pegin_1.peginCli)([
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
        logger_1.logger.log('Pegin Result: ', peginResult);
        logger_1.logger.log('*** Generate a block ***');
        await (0, bitcoin_utils_1.generateBlocks)(1);
        logger_1.logger.log('*** User payment ***');
        const pegoutAmount = 666666;
        const charmsUserPaymentResult = await (0, user_payment_1.userPaymentCli)([
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
        logger_1.logger.log('Charms User Payment Result: ', charmsUserPaymentResult);
        logger_1.logger.log('*** Peg-out ***');
        const pegoutResult = await (0, pegout_1.pegoutCli)([
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
        logger_1.logger.log('Pegout Result:', pegoutResult);
    });
});
