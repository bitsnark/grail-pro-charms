"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generate_random_keypairs_1 = require("../src/cli/generate-random-keypairs");
const deploy_1 = require("../src/cli/deploy");
const pegin_1 = require("../src/cli/pegin");
const user_payment_1 = require("../src/cli/user-payment");
const logger_1 = require("../src/core/logger");
const bitcoin_utils_1 = require("./bitcoin-utils");
const transfer_1 = require("../src/cli/transfer");
jest.setTimeout(600000000);
logger_1.logger.setLoggerOptions(logger_1.DEBUG_LEVELS.ALL, true, true); // Set debug level to ALL, print date and level
describe('peg-in and transfer e2e test', () => {
    it('should deploy, then peg-in, then transfer successfully', async () => {
        const deployerKaypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
        const deployerPublicKey = deployerKaypair.publicKey.toString('hex');
        const deployerPrivateKey = deployerKaypair.privateKey.toString('hex');
        logger_1.logger.log('Deployer Public Key:', deployerPublicKey);
        logger_1.logger.log('Deployer Private Key:', deployerPrivateKey);
        logger_1.logger.log('*** Deploying NFT ***');
        const deployResult = await (0, deploy_1.deployNftCli)([
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
        logger_1.logger.log('Deployment Result:', deployResult);
        logger_1.logger.log('*** User payment ***');
        const newKeypair = (0, generate_random_keypairs_1.generateRandomKeypair)();
        const newPublicKey = newKeypair.publicKey.toString('hex');
        const newPrivateKey = newKeypair.privateKey.toString('hex');
        logger_1.logger.log('New Public Key:', newPublicKey);
        const peginAmount = 1000000;
        const userPaymentResult = await (0, user_payment_1.userPaymentCli)([
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
        logger_1.logger.log('User Payment Result:', userPaymentResult);
        logger_1.logger.log('*** Peg-in ***');
        const peginResult = await (0, pegin_1.peginCli)([
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
        logger_1.logger.log('Pegin Result:', peginResult);
        logger_1.logger.log('*** Generate a block ***');
        await (0, bitcoin_utils_1.generateBlocks)(1);
        logger_1.logger.log('*** transfer ***');
        const transmitAmount = 666666;
        const transferResult = await (0, transfer_1.transferCli)([
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
        logger_1.logger.log('Transfer Result:', transferResult);
    });
});
