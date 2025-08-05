import fs from 'fs';
import path from 'path';
import { deployNftCli } from "../src/cli/deploy";
import { updateNftCli } from "../src/cli/update";
import { BitcoinClient } from "../src/core/bitcoin";

jest.setTimeout(1200000);

// Cosigner constants
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

describe('update e2e test', () => {
  let deploymentResult: any;


  beforeEach(async () => {
    const deployerPublicKey = COSIGNER_0.publicKey;

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

  describe('update the deployment NFT 2 cosigners', () => {

    it('should update the deployment NFT with cosigners: [1,2] - threshold: 1 - signing with deployer', async () => {
      const newCosigners = [COSIGNER_1, COSIGNER_2];
      const newThreshold = 1;
      const signers = [COSIGNER_0];

      const updateResult = await update(deploymentResult, signers, newCosigners, newThreshold);

      expect(updateResult).toBeTruthy();
      expect(updateResult.spellTxid).toBeDefined();
    });

    it('should update the NFT co[1,2], t:1  with cosigners: [2,3] - threshold: 1 - signing with cosigner: [1]', async () => {

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

    xit('should update the NFT co[1,2], t:1  with cosigners: [2,3] - threshold: 1 - signing with cosigner: [2]', async () => {
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


    xit('should update the NFT co[1,2], t:2  with cosigners: [2,3] - threshold: 1 - signing with cosigner: [1,2]', async () => {
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

  });

  xdescribe(' update the deployment NFT 3 cosigners with threshold 1', () => {

    it('should update the deployment NFT with cosigners: [1,2,3] - threshold: 3 - signing with deployer', async () => {
      await mintBlock();

      // update from deployment to [1,2,3]
      const fromCosigners = [COSIGNER_1, COSIGNER_2, COSIGNER_3];
      const fromThreshold = 3;
      const deployer = [COSIGNER_0];
      const result = await update(deploymentResult, deployer, fromCosigners, fromThreshold);

      expect(result).toBeTruthy();
      expect(result.spellTxid).toBeDefined();
    });

    it('should update the NFT co[1,2,3], t:3  with cosigners: [2,3] - threshold: 1 - signing with cosigner: [1,2,3]', async () => {
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

  });

  async function update(prevResult: any, signers: any[], newCosigners: any[], newThreshold: number) {
    return await updateNftWithTempFile(
      deploymentResult,
      prevResult.spellTxid,
      signers.map(s => s.privateKey).join(','),
      {
        publicKeys: newCosigners.map(c => c.publicKey),
        threshold: newThreshold
      }
    );
  }


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

