"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../src/core/logger");
const user_payment_1 = require("../../src/cli/user-payment");
jest.setTimeout(1200000);
logger_1.logger.setLoggerOptions(logger_1.DEBUG_LEVELS.ALL, true, true);
// Cosigner constants (same as other test files)
const COSIGNER_0 = {
    publicKey: 'daa3808e8962acad07bedbbcb94ef7d0f7551cc5188e5dd35eae2dd60d0b8c4f',
    privateKey: '8fea1c500f8414dcc513c4931bc1e1684ce2d3bbe29dbd3b65f7d28fa491a6d8'
};
const COSIGNER_1 = {
    publicKey: '5e5479eb816efb7c90ac4134bc84d0b9aae8a5bcad9c576ec096a7419772cce7',
    privateKey: 'adebcf9c8b25776294f15a95878850c07c402c9fa4e2bcd30a9fe008211a5bc8'
};
const COSIGNER_2 = {
    publicKey: '52e47c861585d68c876771a581cf523a04a6621e06c3e9876c0151237755ec5f',
    privateKey: '9a130b7fea1ce168861aa4e1a0a54a212836434ee7c5b1721156b17e4695f1ee'
};
const COSIGNER_3 = {
    publicKey: '9ca7db41e7ee352ea9f4d3021029e7f0e24a525b2d70ee49b23c82f76d7b577b',
    privateKey: '1cd377ff0666e4f16922910dfad570199c257ca72c19418dd47eac3701edf548'
};
describe('btc-user-payment e2e test', () => {
    // Mock deployment result with hardcoded values to avoid deployment overhead
    const deploymentResult = {
        appId: 'mock-app-id-1234567890abcdef',
        appVk: 'mock-app-vk-1234567890abcdef',
        spellTxid: 'mock-spell-txid-1234567890abcdef'
    };
    describe('should create BTC user payments with different cosigner configurations', () => {
        it('should create BTC user payment with single cosigner', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with 2 cosigners threshold 1', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with 2 cosigners threshold 2', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
                currentThreshold: 2,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with 3 cosigners threshold 1', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with 3 cosigners threshold 2', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
                currentThreshold: 2,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with 3 cosigners threshold 3', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
                currentThreshold: 3,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
    describe('should handle different amounts', () => {
        it('should create BTC user payment with small amount', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 1000
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with large amount', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 1000000
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
    describe('should handle different feerates', () => {
        it('should create BTC user payment with low feerate', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                feerate: 0.00001
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with high feerate', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                feerate: 0.00005
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
    describe('should handle different network configurations', () => {
        it('should create BTC user payment on regtest network', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                network: 'regtest'
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
    describe('should handle different proof configurations', () => {
        it('should create BTC user payment with mock proof', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                mockProof: true
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with skip proof', async () => {
            const userPaymentResult = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                skipProof: true
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
    describe('should handle edge cases', () => {
        it('should create multiple BTC user payments with same cosigners', async () => {
            // First payment
            const userPaymentResult1 = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult1);
            // Second payment
            const userPaymentResult2 = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult2);
            // Should have different recovery public keys
            expect(userPaymentResult1.recoveryPublicKey).not.toBe(userPaymentResult2.recoveryPublicKey);
        });
        it('should create user payments with different cosigner order', async () => {
            // Payment with cosigners in order [1,2,3]
            const userPaymentResult1 = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult1);
            // Payment with cosigners in order [3,2,1]
            const userPaymentResult2 = await createBtcUserPayment({
                currentPublicKeys: [COSIGNER_3.publicKey, COSIGNER_2.publicKey, COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult2);
        });
    });
    // Helper function to create BTC user payment
    async function createBtcUserPayment(options) {
        const args = [
            '--type', 'btc',
            '--app-id', deploymentResult.appId,
            '--app-vk', deploymentResult.appVk,
            '--current-public-keys', options.currentPublicKeys.join(','),
            '--current-threshold', options.currentThreshold.toString(),
            '--amount', options.amount.toString(),
        ];
        if (options.feerate !== undefined) {
            args.push('--feerate', options.feerate.toString());
        }
        if (options.network !== undefined) {
            args.push('--network', options.network);
        }
        if (options.mockProof !== undefined) {
            args.push('--mock-proof', options.mockProof.toString());
        }
        if (options.skipProof !== undefined) {
            args.push('--skip-proof', options.skipProof.toString());
        }
        return await (0, user_payment_1.userPaymentCli)(args);
    }
    // Helper function to validate user payment result
    function validateUserPaymentResult(userPaymentResult) {
        expect(userPaymentResult).toBeTruthy();
        expect(userPaymentResult.txid).toBeDefined();
        expect(userPaymentResult.recoveryPublicKey).toBeDefined();
        expect(typeof userPaymentResult.txid).toBe('string');
        expect(typeof userPaymentResult.recoveryPublicKey).toBe('string');
        expect(userPaymentResult.txid.length).toBeGreaterThan(0);
        expect(userPaymentResult.recoveryPublicKey.length).toBeGreaterThan(0);
    }
});
// Separate test suite for helper functions without deployment overhead
describe('btc-user-payment helper functions (fast tests)', () => {
    // Mock deployment result for testing helper functions
    const mockDeploymentResult = {
        appId: 'mock-app-id-1234567890abcdef',
        appVk: 'mock-app-vk-1234567890abcdef',
        spellTxid: 'mock-spell-txid-1234567890abcdef'
    };
    // Helper function to create BTC user payment (local version for testing)
    async function createBtcUserPaymentLocal(options) {
        const args = [
            '--type', 'btc',
            '--app-id', mockDeploymentResult.appId,
            '--app-vk', mockDeploymentResult.appVk,
            '--current-public-keys', options.currentPublicKeys.join(','),
            '--current-threshold', options.currentThreshold.toString(),
            '--amount', options.amount.toString(),
        ];
        if (options.feerate !== undefined) {
            args.push('--feerate', options.feerate.toString());
        }
        if (options.network !== undefined) {
            args.push('--network', options.network);
        }
        if (options.mockProof !== undefined) {
            args.push('--mock-proof', options.mockProof.toString());
        }
        if (options.skipProof !== undefined) {
            args.push('--skip-proof', options.skipProof.toString());
        }
        return await (0, user_payment_1.userPaymentCli)(args);
    }
    // Helper function to validate user payment result
    function validateUserPaymentResult(userPaymentResult) {
        expect(userPaymentResult).toBeTruthy();
        expect(userPaymentResult.txid).toBeDefined();
        expect(userPaymentResult.recoveryPublicKey).toBeDefined();
        expect(typeof userPaymentResult.txid).toBe('string');
        expect(typeof userPaymentResult.recoveryPublicKey).toBe('string');
        expect(userPaymentResult.txid.length).toBeGreaterThan(0);
        expect(userPaymentResult.recoveryPublicKey.length).toBeGreaterThan(0);
    }
    describe('createBtcUserPayment helper function', () => {
        it('should create BTC user payment with basic parameters', async () => {
            const userPaymentResult = await createBtcUserPaymentLocal({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with multiple cosigners', async () => {
            const userPaymentResult = await createBtcUserPaymentLocal({
                currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
                currentThreshold: 2,
                amount: 666666
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with custom feerate', async () => {
            const userPaymentResult = await createBtcUserPaymentLocal({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                feerate: 0.00005
            });
            validateUserPaymentResult(userPaymentResult);
        });
        it('should create BTC user payment with mock proof', async () => {
            const userPaymentResult = await createBtcUserPaymentLocal({
                currentPublicKeys: [COSIGNER_1.publicKey],
                currentThreshold: 1,
                amount: 666666,
                mockProof: true
            });
            validateUserPaymentResult(userPaymentResult);
        });
    });
});
// Helper function to mint blocks (same as other test files)
async function mintBlock() {
    // Skip minting blocks for user-payment tests since we're using mock values
    // and don't need actual Bitcoin functionality
    return ['mock-block-hash'];
}
