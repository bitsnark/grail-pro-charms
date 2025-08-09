/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deployNftCli } from '../../src/cli/deploy';
import { peginCli } from '../../src/cli/pegin';
import { updateNftCli } from '../../src/cli/update';
import { userPaymentCli } from '../../src/cli/user-payment';
import { BitcoinClient } from '../../src/core/bitcoin';

jest.setTimeout(1200000);

// Common CLI arguments for testing
const TEST_CLI_ARGS = [
    '--mock-proof', 'true',
    '--skip-proof', 'true',
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

const COSIGNER_3 = {
    publicKey: '9ca7db41e7ee352ea9f4d3021029e7f0e24a525b2d70ee49b23c82f76d7b577b',
    privateKey:
        '1cd377ff0666e4f16922910dfad570199c257ca72c19418dd47eac3701edf548',
};

describe('pegin e2e test', () => {
    let update: any;
    let payment: any;
    let app: any;

    beforeEach(async () => {

        // Deploy the NFT using the CLI
        const deployment = await deployNftCli([
            '--deployer-public-key', DEPLOYER.publicKey,
            '--ticker', 'TESTNFT',
            ...TEST_CLI_ARGS,
        ]);

        app = { appId: deployment.appId, appVk: deployment.appVk };

        // Update the NFT to [1,2] t:1 
        update = await updateNftWithTempGrailState(
            app,
            deployment.spellTxid,
            [COSIGNER_1, COSIGNER_2],
            1,
            DEPLOYER.privateKey
        );
    });

    it('should execute a pegin successfully', async () => {
        await mintBlock();

        // Create user payment
        payment = await userPaymentCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--type', 'btc',
            '--current-public-keys', `${COSIGNER_1.publicKey},${COSIGNER_2.publicKey}`,
            '--current-threshold', '1',
            '--amount', '500000',
            ...TEST_CLI_ARGS,
        ]);

        await mintBlock();

        const peginResult = await peginCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', update.spellTxid,

            // Those are to search for the user payment vout and setup the new nft state
            '--user-payment-txid', payment.txid,
            '--new-public-keys', `${COSIGNER_1.publicKey},${COSIGNER_2.publicKey}`,
            '--new-threshold', '1',
            '--recovery-public-key', payment.recoveryPublicKey,

            '--private-keys', `${COSIGNER_1.privateKey},${COSIGNER_2.privateKey}`,
            ...TEST_CLI_ARGS,
        ]);

        expect(peginResult).toBeTruthy();
    });

    it('should update after pegin with new public keys update and new threshold', async () => {
        await mintBlock();

        //Create user payment
        const payment2 = await userPaymentCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--type', 'btc',
            '--current-public-keys', `${COSIGNER_2.publicKey},${COSIGNER_3.publicKey}`,
            '--current-threshold', '2',
            '--amount', '500000',
            ...TEST_CLI_ARGS,
        ]);

        const peginTxIds = await peginCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--previous-nft-txid', update.spellTxid,
            '--new-public-keys', `${COSIGNER_2.publicKey},${COSIGNER_3.publicKey}`,
            '--new-threshold', '2',
            '--private-keys', `${COSIGNER_1.privateKey},${COSIGNER_2.privateKey},${COSIGNER_3.privateKey}`,
            '--recovery-public-key', payment2.recoveryPublicKey,
            '--user-payment-txid', payment2.txid,
            ...TEST_CLI_ARGS,
        ]);

        expect(peginTxIds).toBeTruthy();
        expect(peginTxIds).toHaveLength(2);

        await mintBlock();

        const updateResult = await updateNftWithTempGrailState(
            app,
            peginTxIds[1], // spell txid
            [COSIGNER_1, COSIGNER_2],
            1,
            `${COSIGNER_3.privateKey},${COSIGNER_2.privateKey}`
        );

        expect(updateResult).toBeTruthy();


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
