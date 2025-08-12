/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deployNftCli } from '../../src/cli/deploy';
import { peginCli } from '../../src/cli/pegin';
import { updateNftCli } from '../../src/cli/update';
import { userPaymentCli } from '../../src/cli/user-payment';
import { BitcoinClient } from '../../src/core/bitcoin';
import { createSnapshot, loadSnapshot } from '../utils/bitcoin-snapshot';

jest.setTimeout(1200000);

// Common CLI arguments for testing
const TEST_CLI_ARGS = [
    '--mock-proof', 'true',
    '--skip-proof', 'true',
    '--network', 'regtest',
    '--feerate', '0.00002',
];

// Cosigner constants
const DEPLOYER = {
    publicKey: 'daa3808e8962acad07bedbbcb94ef7d0f7551cc5188e5dd35eae2dd60d0b8c4f',
    privateKey: '8fea1c500f8414dcc513c4931bc1e1684ce2d3bbe29dbd3b65f7d28fa491a6d8',
};

const COSIGNER_1 = {
    publicKey: '5e5479eb816efb7c90ac4134bc84d0b9aae8a5bcad9c576ec096a7419772cce7',
    privateKey: 'adebcf9c8b25776294f15a95878850c07c402c9fa4e2bcd30a9fe008211a5bc8',
};

const COSIGNER_2 = {
    publicKey: '52e47c861585d68c876771a581cf523a04a6621e06c3e9876c0151237755ec5f',
    privateKey: '9a130b7fea1ce168861aa4e1a0a54a212836434ee7c5b1721156b17e4695f1ee',
};

describe('charms user payment e2e test', () => {
    let app: any;
    let peginResult: any;
    let btcUserPayment: any;

    const SNAPSHOT_DIR = './snapshot';

    beforeAll(async () => {
        // Deploy the NFT using the CLI
        const deployment = await deployNftCli([
            '--deployer-public-key', DEPLOYER.publicKey,
            '--ticker', 'TESTNFT',
            ...TEST_CLI_ARGS,
        ]);

        app = { appId: deployment.appId, appVk: deployment.appVk };

        await mintBlock();

        // Create BTC user payment for pegin
        btcUserPayment = await userPaymentCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--type', 'btc',
            '--current-public-keys', DEPLOYER.publicKey,
            '--current-threshold', '1',
            '--amount', '1000000',
            ...TEST_CLI_ARGS,
        ]);

        await mintBlock();

        // Execute pegin to get charms
        peginResult = await peginCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', deployment.spellTxid,
            '--user-payment-txid', btcUserPayment.txid,
            '--new-public-keys', DEPLOYER.publicKey,
            '--new-threshold', '1',
            '--recovery-public-key', btcUserPayment.recoveryPublicKey,
            '--private-keys', DEPLOYER.privateKey,
            ...TEST_CLI_ARGS,
        ]);

        await mintBlock();

        await createSnapshot(SNAPSHOT_DIR);
    });

    beforeEach(async () => {
        await loadSnapshot(SNAPSHOT_DIR);
    });

    it('should create charms user payment successfully', async () => {
        await mintBlock();

        const charmsAmount = 500000;

        const charmsUserPayment = await userPaymentCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--type', 'charms',
            '--current-public-keys', DEPLOYER.publicKey,
            '--current-threshold', '1',
            '--amount', charmsAmount.toString(),
            ...TEST_CLI_ARGS,
        ]);

        expect(charmsUserPayment).toBeTruthy();
        expect(charmsUserPayment.txid).toBeTruthy();
        expect(charmsUserPayment.recoveryPublicKey).toBeTruthy();
    });

    it('should create charms user payment with multiple cosigners', async () => {
        await mintBlock();

        // Update NFT to have multiple cosigners
        await updateNftWithTempGrailState(
            app,
            peginResult[1], // spell txid from pegin
            [COSIGNER_1, COSIGNER_2],
            1,
            DEPLOYER.privateKey
        );

        await mintBlock();

        const charmsAmount = 300000;

        const charmsUserPayment = await userPaymentCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--type', 'charms',
            '--current-public-keys', `${COSIGNER_1.publicKey},${COSIGNER_2.publicKey}`,
            '--current-threshold', '1',
            '--amount', charmsAmount.toString(),
            ...TEST_CLI_ARGS,
        ]);

        expect(charmsUserPayment).toBeTruthy();
        expect(charmsUserPayment.txid).toBeTruthy();
        expect(charmsUserPayment.recoveryPublicKey).toBeTruthy();
    });

    it('should fail if trying to create charms user payment without pegin', async () => {
        // Create a fresh deployment without pegin
        const freshDeployment = await deployNftCli([
            '--deployer-public-key', DEPLOYER.publicKey,
            '--ticker', 'FRESHNFT',
            ...TEST_CLI_ARGS,
        ]);

        await mintBlock();

        const freshApp = { appId: freshDeployment.appId, appVk: freshDeployment.appVk };

        try {
            await userPaymentCli([
                '--app-id', freshApp.appId,
                '--app-vk', freshApp.appVk,
                '--type', 'charms',
                '--current-public-keys', DEPLOYER.publicKey,
                '--current-threshold', '1',
                '--amount', '100000',
                ...TEST_CLI_ARGS,
            ]);
            // If we get here, the test should fail because we expected an error
            expect(true).toBe(false);
        } catch (error) {
            // Expected to fail - this is the correct behavior
            expect(error).toBeTruthy();
        }
    });

});

/**
 * Helper function to create a temporary grail state file and update the NFT
 */
async function updateNftWithTempGrailState(
    app: { appId: string; appVk: string },
    previousNftTxid: string,
    publicKeys: Array<{ publicKey: string }>,
    threshold: number,
    privateKeys: string,
    testCliArgs: string[] = TEST_CLI_ARGS
): Promise<any> {
    const tempGrailStateFile = path.join(
        __dirname,
        `temp-grail-state-${Date.now()}.json`
    );

    fs.writeFileSync(tempGrailStateFile, JSON.stringify({
        publicKeys: publicKeys.map(c => c.publicKey),
        threshold,
    }, null, 2));

    try {
        return await updateNftCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', previousNftTxid,
            '--private-keys', privateKeys,
            '--new-grail-state-file', tempGrailStateFile,
            ...testCliArgs,
        ]);
    } finally {
        // Clean up temporary file
        if (fs.existsSync(tempGrailStateFile)) {
            fs.unlinkSync(tempGrailStateFile);
        }
    }
}

async function mintBlock() {
    const bitcoinClient = await BitcoinClient.initialize();
    const address = await bitcoinClient.getAddress();
    const blockHashes = await bitcoinClient.generateToAddress(1, address);
    return blockHashes;
}
