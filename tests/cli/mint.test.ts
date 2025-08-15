/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deployNftCli } from '../../src/cli/deploy';
import { mintCli } from '../../src/cli/mint';
import { updateNftCli } from '../../src/cli/update';
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

describe('mint e2e test', () => {
    let app: any;
    let deployment: any;

    const SNAPSHOT_DIR = './snapshot';

    beforeAll(async () => {
        // Deploy the NFT using the CLI
        deployment = await deployNftCli([
            '--deployer-public-key', DEPLOYER.publicKey,
            '--ticker', 'TESTNFT',
            ...TEST_CLI_ARGS,
        ]);

        app = { appId: deployment.appId, appVk: deployment.appVk };

        await mintBlock();

        await createSnapshot(SNAPSHOT_DIR);
    });

    beforeEach(async () => {
        await loadSnapshot(SNAPSHOT_DIR);
    });

    it('should execute mint with multiple cosigners', async () => {
        await mintBlock();

        // Update NFT to have multiple cosigners
        const updateResult = await updateNftWithTempGrailState(
            app,
            deployment.spellTxid,
            [COSIGNER_1, COSIGNER_2],
            1,
            DEPLOYER.privateKey
        );

        await mintBlock();

        const mintAmount = 500000;

        const mintResult = await mintCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', updateResult.spellTxid,
            '--private-keys', `${COSIGNER_1.privateKey},${COSIGNER_2.privateKey}`,
            '--amount', mintAmount.toString(),
            '--ticker', 'TESTNFT',
            '--token-name', 'Multi Cosigner Token',
            '--token-image', 'https://example.com/multi.png',
            '--token-url', 'https://example.com/multi',
            '--transmit', 'true',
            ...TEST_CLI_ARGS,
        ]);

        expect(mintResult).toBeTruthy();
        expect(mintResult).toHaveLength(2);
        expect(mintResult[0]).toBeTruthy(); // funding txid
        expect(mintResult[1]).toBeTruthy(); // spell txid
    });

    it('should execute mint with custom user wallet address', async () => {
        await mintBlock();

        const bitcoinClient = await BitcoinClient.initialize();
        const customAddress = await bitcoinClient.getAddress();

        const mintAmount = 300000;

        const mintResult = await mintCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', deployment.spellTxid,
            '--private-keys', DEPLOYER.privateKey,
            '--amount', mintAmount.toString(),
            '--user-wallet-address', customAddress,
            '--ticker', 'TESTNFT',
            '--token-name', 'Custom Address Token',
            '--token-image', 'https://example.com/custom.png',
            '--token-url', 'https://example.com/custom',
            '--transmit', 'true',
            ...TEST_CLI_ARGS,
        ]);

        expect(mintResult).toBeTruthy();
        expect(mintResult).toHaveLength(2);
        expect(mintResult[0]).toBeTruthy(); // funding txid
        expect(mintResult[1]).toBeTruthy(); // spell txid
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
