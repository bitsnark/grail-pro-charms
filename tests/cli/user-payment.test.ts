import { DEBUG_LEVELS, logger } from '../../src/core/logger';
import { deployNftCli } from "../../src/cli/deploy";
import { updateNftCli } from "../../src/cli/update";
import { userPaymentCli } from "../../src/cli/user-payment";
import { BitcoinClient } from "../../src/core/bitcoin";
import fs from 'fs';
import path from 'path';

jest.setTimeout(1200000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true);

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

describe('user-payment e2e test', () => {
  let deploymentResult: any;

  beforeAll(async () => {
    const deployerPublicKey = COSIGNER_0.publicKey;

    // Deploy the NFT using the CLI (only once for all tests)
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

    // Mint a block to ensure deployment is confirmed
    await mintBlock();

    // Update NFT to cosigners 1, 2, 3 with threshold 1
    const updateResult = await updateNftWithTempFile(
      deploymentResult,
      deploymentResult.spellTxid,
      COSIGNER_0.privateKey,
      {
        publicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        threshold: 1
      }
    );

    expect(updateResult).toBeTruthy();
    expect(updateResult.spellTxid).toBeDefined();

    // Update deploymentResult to use the updated NFT txid for subsequent tests
    deploymentResult.spellTxid = updateResult.spellTxid;
  });

  describe('should create BTC user payments with different cosigner configurations', () => {

    it('should create BTC user payment with single cosigner', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 2 cosigners threshold 1', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 2 cosigners threshold 2', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 1', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 2', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 3', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 3,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });
  });

  describe('should create Charms user payments with different cosigner configurations', () => {

    it('should create Charms user payment with single cosigner', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with 2 cosigners threshold 1', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with 2 cosigners threshold 2', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with 3 cosigners threshold 1', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with 3 cosigners threshold 2', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with 3 cosigners threshold 3', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 3,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });
  });

  describe('should handle different amounts', () => {

    it('should create BTC user payment with small amount', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with large amount', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000000
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with small amount', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with large amount', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000000
      });

      validateUserPaymentResult(userPaymentResult);
    });
  });

  describe('should handle different feerates', () => {

    it('should create BTC user payment with low feerate', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00001
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with high feerate', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00005
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with low feerate', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00001
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with high feerate', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
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
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        network: 'regtest'
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment on regtest network', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
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
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        mockProof: true
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with skip proof', async () => {
      await mintBlock();

      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        skipProof: true
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with mock proof', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        mockProof: true
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with skip proof', async () => {
      await mintBlock();

      const userPaymentResult = await createCharmsUserPayment({
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
      await mintBlock();

      // First payment
      const userPaymentResult1 = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult1);

      await mintBlock();

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

    it('should create multiple Charms user payments with same cosigners', async () => {
      await mintBlock();

      // First payment
      const userPaymentResult1 = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult1);

      await mintBlock();

      // Second payment
      const userPaymentResult2 = await createCharmsUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult2);

      // Should have different recovery public keys
      expect(userPaymentResult1.recoveryPublicKey).not.toBe(userPaymentResult2.recoveryPublicKey);
    });

    it('should create user payments with different cosigner order', async () => {
      await mintBlock();

      // Payment with cosigners in order [1,2,3]
      const userPaymentResult1 = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult1);

      await mintBlock();

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
  async function createBtcUserPayment(options: {
    currentPublicKeys: string[];
    currentThreshold: number;
    amount: number;
    feerate?: number;
    network?: string;
    mockProof?: boolean;
    skipProof?: boolean;
  }) {
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

    return await userPaymentCli(args);
  }

  // Helper function to create Charms user payment
  async function createCharmsUserPayment(options: {
    currentPublicKeys: string[];
    currentThreshold: number;
    amount: number;
    feerate?: number;
    network?: string;
    mockProof?: boolean;
    skipProof?: boolean;
  }) {
    const args = [
      '--type', 'charms',
      '--app-id', deploymentResult.appId,
      '--app-vk', deploymentResult.appVk,
      '--current-public-keys', options.currentPublicKeys.join(','),
      '--current-threshold', options.currentThreshold.toString(),
      '--amount', options.amount.toString(),
      '--feerate', (options.feerate || 0.00002).toString(),
    ];

    if (options.network !== undefined) {
      args.push('--network', options.network);
    }
    if (options.mockProof !== undefined) {
      args.push('--mock-proof', options.mockProof.toString());
    }
    if (options.skipProof !== undefined) {
      args.push('--skip-proof', options.skipProof.toString());
    }

    return await userPaymentCli(args);
  }

  // Helper function to validate user payment result
  function validateUserPaymentResult(userPaymentResult: any) {
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
describe('user-payment helper functions (fast tests)', () => {
  // Mock deployment result for testing helper functions
  const mockDeploymentResult = {
    appId: 'mock-app-id',
    appVk: 'mock-app-vk',
    spellTxid: 'mock-spell-txid'
  };

  // Helper function to create BTC user payment (local version for testing)
  async function createBtcUserPaymentLocal(options: {
    currentPublicKeys: string[];
    currentThreshold: number;
    amount: number;
    feerate?: number;
    network?: string;
    mockProof?: boolean;
    skipProof?: boolean;
  }) {
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

    return await userPaymentCli(args);
  }

  // Helper function to create Charms user payment (local version for testing)
  async function createCharmsUserPaymentLocal(options: {
    currentPublicKeys: string[];
    currentThreshold: number;
    amount: number;
    feerate?: number;
    network?: string;
    mockProof?: boolean;
    skipProof?: boolean;
  }) {
    const args = [
      '--type', 'charms',
      '--app-id', mockDeploymentResult.appId,
      '--app-vk', mockDeploymentResult.appVk,
      '--current-public-keys', options.currentPublicKeys.join(','),
      '--current-threshold', options.currentThreshold.toString(),
      '--amount', options.amount.toString(),
      '--feerate', (options.feerate || 0.00002).toString(),
    ];

    if (options.network !== undefined) {
      args.push('--network', options.network);
    }
    if (options.mockProof !== undefined) {
      args.push('--mock-proof', options.mockProof.toString());
    }
    if (options.skipProof !== undefined) {
      args.push('--skip-proof', options.skipProof.toString());
    }

    return await userPaymentCli(args);
  }

  // Helper function to validate user payment result
  function validateUserPaymentResult(userPaymentResult: any) {
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

  describe('createCharmsUserPayment helper function', () => {
    it('should create Charms user payment with basic parameters', async () => {
      const userPaymentResult = await createCharmsUserPaymentLocal({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with multiple cosigners', async () => {
      const userPaymentResult = await createCharmsUserPaymentLocal({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with custom feerate', async () => {
      const userPaymentResult = await createCharmsUserPaymentLocal({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00005
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create Charms user payment with mock proof', async () => {
      const userPaymentResult = await createCharmsUserPaymentLocal({
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
  const bitcoinClient = await BitcoinClient.initialize();
  const address = await bitcoinClient.getAddress();
  const blockHashes = await bitcoinClient.generateToAddress(1, address);
  return blockHashes;
}

// Helper function to update NFT with temporary grail state file (same as other test files)
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