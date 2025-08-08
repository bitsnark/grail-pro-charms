/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deployNftCli } from '../../src/cli/deploy';
import { peginCli } from '../../src/cli/pegin';
import { updateNftCli } from '../../src/cli/update';
import { userPaymentCli } from '../../src/cli/user-payment';
import { BitcoinClient } from '../../src/core/bitcoin';

jest.setTimeout(1200000);

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

describe('pegin e2e test', () => {
    let updateResult: any;
    let paymentResult: any;
    let app: any;

    beforeEach(async () => {

        // Deploy the NFT using the CLI
        const deploymentResult = await deployNftCli([
            '--deployer-public-key', DEPLOYER.publicKey,
            '--mock-proof', 'true',
            '--network', 'regtest',
            '--feerate', '0.00002',
            '--transmit', 'true',
            '--ticker', 'TESTNFT',
        ]);

        app = { appId: deploymentResult.appId, appVk: deploymentResult.appVk };

        // Update the NFT to [1,2] t:1 
        const tempGrailStateFile = path.join(
            __dirname,
            `temp-grail-state-${Date.now()}.json`
        );
        fs.writeFileSync(tempGrailStateFile, JSON.stringify({
            publicKeys: [COSIGNER_1, COSIGNER_2].map(c => c.publicKey),
            threshold: 1,
        }, null, 2));

        try {
            updateResult = await updateNftCli([
                '--app-id', app.appId,
                '--app-vk', app.appVk,
                '--previous-nft-txid', deploymentResult.spellTxid,
                '--private-keys', [DEPLOYER].map(s => s.privateKey).join(','),
                '--new-grail-state-file', tempGrailStateFile,
                '--feerate', '0.00002',
                '--mock-proof', 'true',
                '--transmit', 'true',
            ]);
        } finally {
            // Clean up temporary file
            if (fs.existsSync(tempGrailStateFile)) {
                fs.unlinkSync(tempGrailStateFile);
            }
        }

        // Step 2: Mint block to confirm update
        await mintBlock();

        // Step 3: Create user payment
        paymentResult = await userPaymentCli([
            '--type', 'btc',
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--current-public-keys', `${COSIGNER_1.publicKey},${COSIGNER_2.publicKey}`,
            '--current-threshold', '1',
            '--amount', '500000',
        ]);

    });

    it('should execute a pegin successfully', async () => {
        // Step 4: Mint block to confirm payment
        await mintBlock();

        // Step 5: Execute PegIn
        const peginResult = await peginCli([
            '--app-id', app.appId,
            '--app-vk', app.appVk,
            '--new-public-keys', `${COSIGNER_1.publicKey},${COSIGNER_2.publicKey}`,
            '--new-threshold', '1',
            '--previous-nft-txid', updateResult.spellTxid,
            '--recovery-public-key', paymentResult.recoveryPublicKey,
            '--private-keys', `${COSIGNER_1.privateKey},${COSIGNER_2.privateKey}`,
            '--user-payment-txid', paymentResult.txid,
            '--mock-proof', 'true',
            '--transmit', 'true',
        ]);

        expect(peginResult).toBeTruthy();
    });
});

async function mintBlock() {
    const bitcoinClient = await BitcoinClient.initialize();
    const address = await bitcoinClient.getAddress();
    const blockHashes = await bitcoinClient.generateToAddress(1, address);
    return blockHashes;
}
