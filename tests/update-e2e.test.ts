import { generateRandomKeypair } from "../src/cli/generate-random-keypairs";
import { deployNftCli } from "../src/cli/deploy";
import { updateNftCli } from "../src/cli/update";
import fs from 'fs';
import path from 'path';

jest.setTimeout(1200000);

describe('update e2e test', () => {
  let deployerPublicKey: string;
  let deployerPrivateKey: string;
  let deploymentResult: any;
  let updateResult: any;

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
    const cosigner1 = generateRandomKeypair();
    const cosigner2 = generateRandomKeypair();
    const cosigner3 = generateRandomKeypair();

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
}); 