"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const deploy_1 = require("../../src/cli/deploy");
const update_1 = require("../../src/cli/update");
const bitcoin_1 = require("../../src/core/bitcoin");
jest.setTimeout(1200000);
// Cosigner constants
//3
const COSIGNER_0 = {
    publicKey: 'daa3808e8962acad07bedbbcb94ef7d0f7551cc5188e5dd35eae2dd60d0b8c4f',
    privateKey: '8fea1c500f8414dcc513c4931bc1e1684ce2d3bbe29dbd3b65f7d28fa491a6d8',
};
//1
const COSIGNER_1 = {
    publicKey: '5e5479eb816efb7c90ac4134bc84d0b9aae8a5bcad9c576ec096a7419772cce7',
    privateKey: 'adebcf9c8b25776294f15a95878850c07c402c9fa4e2bcd30a9fe008211a5bc8',
};
//0
const COSIGNER_2 = {
    publicKey: '52e47c861585d68c876771a581cf523a04a6621e06c3e9876c0151237755ec5f',
    privateKey: '9a130b7fea1ce168861aa4e1a0a54a212836434ee7c5b1721156b17e4695f1ee',
};
//2
const COSIGNER_3 = {
    publicKey: '9ca7db41e7ee352ea9f4d3021029e7f0e24a525b2d70ee49b23c82f76d7b577b',
    privateKey: '1cd377ff0666e4f16922910dfad570199c257ca72c19418dd47eac3701edf548',
};
describe('update e2e test', () => {
    let deploymentResult;
    beforeEach(async () => {
        const deployerPublicKey = COSIGNER_0.publicKey;
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
    });
    describe('should allow cosigner rotation with 2 cosigners', () => {
        it('deployer signs: deployment → [1,2] t:1', async () => {
            const newCosigners = [COSIGNER_1, COSIGNER_2];
            const newThreshold = 1;
            const signers = [COSIGNER_0];
            const updateResult = await update(deploymentResult, signers, newCosigners, newThreshold);
            expect(updateResult).toBeTruthy();
            expect(updateResult.spellTxid).toBeDefined();
        });
        it('cosigner [1] signs: [1,2] t:1 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [1,2]
            const fromCosigners = [COSIGNER_1, COSIGNER_2];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2] to [2,3] signing with cosigner: [1]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_1];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        xit('cosigner [2] signs: [1,2] t:1 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [1,2]
            const fromCosigners = [COSIGNER_1, COSIGNER_2];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2] to [2,3] signing with cosigner: [2]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_2];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        xit('cosigner [2] signs: [2,1] t:1 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [2,1]
            const fromCosigners = [COSIGNER_2, COSIGNER_1];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2] to [2,3] signing with cosigner: [2]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_2];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigner [1] signs: [2,1] t:1 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [2,1]
            const fromCosigners = [COSIGNER_2, COSIGNER_1];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2] to [2,3] signing with cosigner: [2]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_1];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigners [1,2] sign: [1,2] t:2 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [1,2]
            const fromCosigners = [COSIGNER_1, COSIGNER_2];
            const fromThreshold = 2;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2] to [2,3] signing with cosigner: [1,2]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_1, COSIGNER_2];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigner [3] signs: [2,3] t:1 → [1,2] t:1', async () => {
            await mintBlock();
            // update from deployment to [2,3]
            const fromCosigners = [COSIGNER_2, COSIGNER_3];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [2,3] to [1,2] signing with cosigner: [3]
            const newCosigners = [COSIGNER_1, COSIGNER_2];
            const newThreshold = 1;
            const signers = [COSIGNER_3];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        xit('cosigner [3] signs: [3,2] t:1 → [1,2] t:1', async () => {
            await mintBlock();
            // update from deployment to [3,2]
            const fromCosigners = [COSIGNER_2, COSIGNER_3];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [2,3] to [1,2] signing with cosigner: [3]
            const newCosigners = [COSIGNER_1, COSIGNER_2];
            const newThreshold = 1;
            const signers = [COSIGNER_3];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
    });
    describe('should allow cosigner rotation with 3 cosigners', () => {
        it('deployer signs: deployment → [1,2,3] t:3', async () => {
            await mintBlock();
            // update from deployment to [1,2,3]
            const fromCosigners = [COSIGNER_1, COSIGNER_2, COSIGNER_3];
            const fromThreshold = 3;
            const deployer = [COSIGNER_0];
            const result = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigners [1,2,3] signs: [1,2,3] t:3 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [1,2,3]
            const fromCosigners = [COSIGNER_1, COSIGNER_2, COSIGNER_3];
            const fromThreshold = 3;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2,3] to [2,3] signing with cosigner: [1,2,3]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_1, COSIGNER_2, COSIGNER_3];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigners [3,2] signs: [1,2,3] t:2 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [1,2,3]
            const fromCosigners = [COSIGNER_1, COSIGNER_2, COSIGNER_3];
            const fromThreshold = 2;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [1,2,3] to [2,3] signing with cosigner: [3,2]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_3, COSIGNER_2];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
        it('cosigners [1] signs: [2,3,1] t:1 → [2,3] t:1', async () => {
            await mintBlock();
            // update from deployment to [2,3,1]
            const fromCosigners = [COSIGNER_2, COSIGNER_3, COSIGNER_1];
            const fromThreshold = 1;
            const deployer = [COSIGNER_0];
            const updateResult = await update(deploymentResult, deployer, fromCosigners, fromThreshold);
            // update from [2,3,1] to [2,3] signing with cosigner: [1]
            const newCosigners = [COSIGNER_2, COSIGNER_3];
            const newThreshold = 1;
            const signers = [COSIGNER_1];
            const result = await update(updateResult, signers, newCosigners, newThreshold);
            expect(result).toBeTruthy();
            expect(result.spellTxid).toBeDefined();
        });
    });
    // HELPER FUNCTIONS
    async function update(prevResult, signers, newCosigners, newThreshold) {
        return await updateNftWithTempFile(deploymentResult, prevResult.spellTxid, signers.map(s => s.privateKey).join(','), {
            publicKeys: newCosigners.map(c => c.publicKey),
            threshold: newThreshold,
        });
    }
});
// Helper function to update NFT with temporary grail state file
const updateNftWithTempFile = async (deploymentResult, previousNftTxid, privateKeys, newGrailState, feerate = '0.00002') => {
    const tempGrailStateFile = path_1.default.join(__dirname, `temp-grail-state-${Date.now()}.json`);
    fs_1.default.writeFileSync(tempGrailStateFile, JSON.stringify(newGrailState, null, 2));
    try {
        const result = await (0, update_1.updateNftCli)([
            '--app-id',
            deploymentResult.appId,
            '--app-vk',
            deploymentResult.appVk,
            '--previous-nft-txid',
            previousNftTxid,
            '--private-keys',
            privateKeys,
            '--new-grail-state-file',
            tempGrailStateFile,
            '--feerate',
            feerate,
            '--mock-proof',
            'true',
            '--transmit',
            'true',
        ]);
        return result;
    }
    finally {
        // Clean up temporary file
        if (fs_1.default.existsSync(tempGrailStateFile)) {
            fs_1.default.unlinkSync(tempGrailStateFile);
        }
    }
};
async function mintBlock() {
    const bitcoinClient = await bitcoin_1.BitcoinClient.initialize();
    const address = await bitcoinClient.getAddress();
    const blockHashes = await bitcoinClient.generateToAddress(1, address);
    return blockHashes;
}
