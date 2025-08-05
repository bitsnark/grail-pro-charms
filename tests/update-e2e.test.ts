import fs from 'fs';
import path from 'path';
import { deployNftCli } from "../src/cli/deploy";
import { updateNftCli } from "../src/cli/update";
import { BitcoinClient } from "../src/core/bitcoin";

jest.setTimeout(1200000);

describe('update e2e test', () => {
  let deployerPublicKey: string;
  let deployerPrivateKey: string;
  let deploymentResult: any;
  let updateResult: any;
  let cosigner0: any;
  let cosigner1: any;
  let cosigner2: any;
  let cosigner3: any;
  let updateResult2: any;


  beforeAll(async () => {
    cosigner0 = {
      publicKey: 'daa3808e8962acad07bedbbcb94ef7d0f7551cc5188e5dd35eae2dd60d0b8c4f',
      privateKey: '8fea1c500f8414dcc513c4931bc1e1684ce2d3bbe29dbd3b65f7d28fa491a6d8'
    };

    cosigner1 = {
      publicKey: '5e5479eb816efb7c90ac4134bc84d0b9aae8a5bcad9c576ec096a7419772cce7',
      privateKey: 'adebcf9c8b25776294f15a95878850c07c402c9fa4e2bcd30a9fe008211a5bc8'
    };
    cosigner2 = {
      publicKey: '52e47c861585d68c876771a581cf523a04a6621e06c3e9876c0151237755ec5f',
      privateKey: '9a130b7fea1ce168861aa4e1a0a54a212836434ee7c5b1721156b17e4695f1ee'
    };
    cosigner3 = {
      publicKey: '9ca7db41e7ee352ea9f4d3021029e7f0e24a525b2d70ee49b23c82f76d7b577b',
      privateKey: '1cd377ff0666e4f16922910dfad570199c257ca72c19418dd47eac3701edf548'
    };

    deployerPublicKey = cosigner0.publicKey;
    deployerPrivateKey = cosigner0.privateKey

    // Deploy the NFT using the CLI
    deploymentResult = await deployNftCli([
      '--deployer-public-key', deployerPublicKey,
      '--mock-proof', 'true',
      '--network', 'regtest',
      '--feerate', '0.00002',
      '--transmit', 'true',
      '--ticker', 'TESTNFT'
    ]);


    expect(deploymentResult).toBeTruthy();
    expect(deploymentResult.appId).toBeDefined();
    expect(deploymentResult.appVk).toBeDefined();
    expect(deploymentResult.spellTxid).toBeDefined();
    console.log('Deployment Result:', deploymentResult);
  });

  it('should update the deployment NFT with cosigners: [1,2] - threshold: 1 - signing with deployer', async () => {
    const newGrailState = {
      publicKeys: [
        cosigner1.publicKey,
        cosigner2.publicKey,
      ],
      threshold: 1
    };

    updateResult = await updateNftWithTempFile(
      deploymentResult,
      deploymentResult.spellTxid,
      deployerPrivateKey,
      newGrailState
    );

    console.log('Update Result:', updateResult);
    expect(updateResult).toBeTruthy();
    expect(updateResult.spellTxid).toBeDefined();
  });

  it('should update the NFT with cosigners: [2,3] - threshold: 1 - signing with cosigner: [1]', async () => {

    // Mint a block in regtest to confirm the first update
    const blockHashes = await mintBlock();

    expect(blockHashes).toBeDefined();
    expect(blockHashes.length).toBe(1);
    expect(blockHashes[0]).toBeDefined();


    expect(updateResult).toBeDefined();
    expect(cosigner2).toBeDefined();
    expect(cosigner3).toBeDefined();

    // Create new grail state with only cosigner2 and cosigner3, threshold 1
    const newGrailState2 = {
      publicKeys: [
        cosigner2.publicKey,
        cosigner3.publicKey,
      ],
      threshold: 1
    };

    // Execute update using helper function
    updateResult2 = await updateNftWithTempFile(
      deploymentResult,
      updateResult.spellTxid,
      cosigner1.privateKey,
      newGrailState2
    );

    expect(updateResult2).toBeTruthy();
    expect(updateResult2.spellTxid).toBeDefined();
    console.log('Second Update Result:', updateResult2);
  });
});

// Helper function to update NFT with temporary grail state file
const updateNftWithTempFile = async (
  deploymentResult: any,
  previousNftTxid: string,
  privateKeys: string,
  newGrailState: any,
  feerate: string = '0.00002'
) => {
  const tempGrailStateFile = path.join(__dirname, `temp-grail-state-${Date.now()}.json`);
  fs.writeFileSync(tempGrailStateFile, JSON.stringify(newGrailState, null, 2));

  try {
    const result = await updateNftCli([
      '--app-id', deploymentResult.appId,
      '--app-vk', deploymentResult.appVk,
      '--previous-nft-txid', previousNftTxid,
      '--private-keys', privateKeys,
      '--new-grail-state-file', tempGrailStateFile,
      '--feerate', feerate,
      '--mock-proof', 'true',
      '--transmit', 'true'
    ]);

    return result;
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempGrailStateFile)) {
      fs.unlinkSync(tempGrailStateFile);
    }
  }
};

async function mintBlock() {
  const bitcoinClient = await BitcoinClient.initialize();
  const address = await bitcoinClient.getAddress();
  const blockHashes = await bitcoinClient.generateToAddress(1, address);
  return blockHashes;
}

