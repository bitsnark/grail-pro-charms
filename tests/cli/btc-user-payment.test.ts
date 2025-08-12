import { userPaymentCli } from "../../src/cli/user-payment";
import { DEBUG_LEVELS, logger } from '../../src/core/logger';

jest.setTimeout(1200000);
logger.setLoggerOptions(DEBUG_LEVELS.ALL, true, true);

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

// Helper function to validate user payment result
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateUserPaymentResult(userPaymentResult: any) {
  expect(userPaymentResult).toBeTruthy();
  expect(userPaymentResult.txid).toBeDefined();
  expect(userPaymentResult.recoveryPublicKey).toBeDefined();
  expect(typeof userPaymentResult.txid).toBe('string');
  expect(typeof userPaymentResult.recoveryPublicKey).toBe('string');
  expect(userPaymentResult.txid.length).toBeGreaterThan(0);
  expect(userPaymentResult.recoveryPublicKey.length).toBeGreaterThan(0);
}

// Helper function to create BTC user payment
async function createBtcUserPayment(options: {
  currentPublicKeys: string[];
  currentThreshold: number;
  amount: number;
  feerate?: number;
  network?: string;
}) {
  const args = [
    '--type', 'btc',
    '--app-id', 'mock-app-id-1234567890abcdef',
    '--app-vk', 'mock-app-vk-1234567890abcdef',
    '--current-public-keys', options.currentPublicKeys.join(','),
    '--current-threshold', options.currentThreshold.toString(),
    '--amount', options.amount.toString(),
    '--mock-proof', 'true',
    '--skip-proof', 'true',
  ];

  if (options.feerate !== undefined) {
    args.push('--feerate', options.feerate.toString());
  }
  if (options.network !== undefined) {
    args.push('--network', options.network);
  }

  return await userPaymentCli(args);
}

describe('btc-user-payment e2e test', () => {

  describe('should create BTC user payments with different cosigner configurations', () => {

    it('should create BTC user payment with single cosigner', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 2 cosigners threshold 1', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 2 cosigners threshold 2', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 1', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 2', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 2,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with 3 cosigners threshold 3', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 3,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult);
    });
  });

  describe('should handle different amounts', () => {

    it('should create BTC user payment with small amount', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with large amount', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 1000000
      });

      validateUserPaymentResult(userPaymentResult);
    });


  });

  describe('should handle different feerates', () => {

    it('should create BTC user payment with low feerate', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00001
      });

      validateUserPaymentResult(userPaymentResult);
    });

    it('should create BTC user payment with high feerate', async () => {
      const userPaymentResult = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666,
        feerate: 0.00005
      });

      validateUserPaymentResult(userPaymentResult);
    });


    it('should create user payments with different cosigner order', async () => {
      // Payment with cosigners in order [1,2,3]
      const userPaymentResult1 = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_1.publicKey, COSIGNER_2.publicKey, COSIGNER_3.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult1);

      // Payment with cosigners in order [3,2,1]
      const userPaymentResult2 = await createBtcUserPayment({
        currentPublicKeys: [COSIGNER_3.publicKey, COSIGNER_2.publicKey, COSIGNER_1.publicKey],
        currentThreshold: 1,
        amount: 666666
      });

      validateUserPaymentResult(userPaymentResult2);
    });
  });
});