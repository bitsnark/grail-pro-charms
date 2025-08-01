import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";
import { updateNftCli } from "../src/cli/update";
import { BitcoinClient } from "../src/core/bitcoin";
import fs from 'fs';
import path from 'path';

jest.setTimeout(1200000);

describe('update e2e test', () => {
  let deployerPublicKey: string;
  let deployerPrivateKey: string;
  let deploymentResult: any;
  let updateResult: any;
  let cosigner1: any;
  let cosigner2: any;
  let cosigner3: any;
  let updateResult2: any;

  it('should generate random keypair for deployer', async () => {
    // Generate a random keypair for the deployer
    const deployerKeypair = generateRandomKeypair();
    deployerPublicKey = deployerKeypair.publicKey.toString('hex');
    deployerPrivateKey = deployerKeypair.privateKey.toString('hex');

    console.log('Deployer Public Key:', deployerPublicKey);
    console.log('Deployer Private Key:', deployerPrivateKey);

    expect(deployerPublicKey).toBeDefined();
    expect(deployerPrivateKey).toBeDefined();
  });

  it('should deploy the NFT', async () => {
    expect(deployerPublicKey).toBeDefined();

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

  it('should update the NFT with 3 cosigners and threshold 2', async () => {
    expect(deploymentResult).toBeDefined();
    expect(deployerPublicKey).toBeDefined();
    expect(deployerPrivateKey).toBeDefined();

    // Generate 3 additional cosigners
    cosigner1 = generateRandomKeypair();
    cosigner2 = generateRandomKeypair();
    cosigner3 = generateRandomKeypair();

    // Create new grail state with 4 cosigners total (original + 3 new) and threshold 2
    const newGrailState = {
      publicKeys: [
        deployerPublicKey,
        cosigner1.publicKey.toString('hex'),
        cosigner2.publicKey.toString('hex'),
        cosigner3.publicKey.toString('hex')
      ],
      threshold: 2
    };

    // Create temporary grail state file
    const tempGrailStateFile = path.join(__dirname, 'temp-grail-state.json');
    fs.writeFileSync(tempGrailStateFile, JSON.stringify(newGrailState, null, 2));

    try {
      // Execute update
      updateResult = await updateNftCli([
        '--app-id', deploymentResult.appId,
        '--app-vk', deploymentResult.appVk,
        '--previous-nft-txid', deploymentResult.spellTxid,
        '--private-keys', deployerPrivateKey,
        '--new-grail-state-file', tempGrailStateFile,
        '--feerate', '0.00002',
        '--mock-proof', 'true',
        '--transmit', 'true'
      ]);
      
      expect(updateResult).toBeTruthy();
      expect(updateResult.spellTxid).toBeDefined();
      console.log('Update Result:', updateResult);
      console.log('New cosigners:');
      console.log('Cosigner 1:', cosigner1.publicKey.toString('hex'));
      console.log('Cosigner 2:', cosigner2.publicKey.toString('hex'));
      console.log('Cosigner 3:', cosigner3.publicKey.toString('hex'));
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempGrailStateFile)) {
        fs.unlinkSync(tempGrailStateFile);
      }
    }
  });

  it('should mint a block to confirm the first update', async () => {
    // Mint a block in regtest to confirm the first update
    const bitcoinClient = await BitcoinClient.initialize();
    const address = await bitcoinClient.getAddress();
    const blockHashes = await bitcoinClient.generateToAddress(1, address);
    
    expect(blockHashes).toBeDefined();
    expect(blockHashes.length).toBe(1);
    expect(blockHashes[0]).toBeDefined();
  });

  it('should update the NFT removing deployer and cosigner1, keeping cosigner2 and cosigner3 with threshold 1', async () => {
    expect(updateResult).toBeDefined();
    expect(cosigner2).toBeDefined();
    expect(cosigner3).toBeDefined();

    // Create new grail state with only cosigner2 and cosigner3, threshold 1
    const newGrailState2 = {
      publicKeys: [
        cosigner2.publicKey.toString('hex'),
        cosigner3.publicKey.toString('hex')
      ],
      threshold: 1
    };

    // Create temporary grail state file
    const tempGrailStateFile2 = path.join(__dirname, 'temp-grail-state-2.json');
    fs.writeFileSync(tempGrailStateFile2, JSON.stringify(newGrailState2, null, 2));

    try {
      // Execute update using all cosigners private keys (previous threshold was 2, so we need 2 signatures)
      updateResult2 = await updateNftCli([
        '--app-id', deploymentResult.appId,
        '--app-vk', deploymentResult.appVk,
        '--previous-nft-txid', updateResult.spellTxid,
        '--private-keys', deployerPrivateKey + ',' + cosigner1.privateKey.toString('hex') + ',' + cosigner2.privateKey.toString('hex') + ',' + cosigner3.privateKey.toString('hex'),
        '--new-grail-state-file', tempGrailStateFile2,
        '--feerate', '0.00002',
        '--mock-proof', 'true',
        '--transmit', 'true'
      ]);
      
      expect(updateResult2).toBeTruthy();
      expect(updateResult2.spellTxid).toBeDefined();
      console.log('Second Update Result:', updateResult2);
      console.log('Remaining cosigners:');
      console.log('Cosigner 2:', cosigner2.publicKey.toString('hex'));
      console.log('Cosigner 3:', cosigner3.publicKey.toString('hex'));
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempGrailStateFile2)) {
        fs.unlinkSync(tempGrailStateFile2);
      }
    }
  });
}); 