import Mustache from 'mustache';
import { executeSpell, getVerificationKey } from './charms-sdk';
import { CharmerRequest } from './types';
import { BitcoinClient } from './bitcoin';

const APP_ID = '54bcbe0b568bed707af3fb5e00f57d6948e19a3ef599bf35fac7632d76fbc203';
let appVk: string | undefined = undefined;

/**
 * Loads a Mustache template from a file, renders it with the provided data,
 * and returns the rendered string.
 *
 * @param template - The template string.
 * @param data - The data to render the template with.
 * @returns The rendered template as a string.
 * @throws If the template file does not exist.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTemplate(template: string, data: any): string {
  return Mustache.render(template, data, {});
}

export async function createSpell(
  bitcoinClient: BitcoinClient,
  template: string,
  previousTxids: string[],
  request: CharmerRequest,
): Promise<Buffer[]> {

  if (!appVk) {
    appVk = await getVerificationKey();
  }

  request.appId = APP_ID;
  request.appVk = appVk;

  const renderedTemplate = renderTemplate(template, request);
  const previousTransactions = await Promise.all(previousTxids.map(async (txid) => bitcoinClient.getTransaction(txid)));
  const output = await executeSpell(
    request.fundingUtxo,
    request.fundingChangeAddress,
    renderedTemplate,
    previousTransactions.map(tx => Buffer.from(tx, 'hex')));

  return output;
}

export async function transmitSpell(bitcoinClient: BitcoinClient, transactions: Buffer[]): Promise<string[]> {
  const commitmentTxHex = transactions[0].toString('hex');
  const signedCommitmentTxHex = await bitcoinClient.signTransaction(commitmentTxHex, undefined, 'ALL|ANYONECANPAY');

  console.info('Sending commitment transaction:', signedCommitmentTxHex);
  const commitmentTxid = await bitcoinClient.transmitTransaction(signedCommitmentTxHex);
  console.info('commitmentTxid:', commitmentTxid);

  const spellTransactionHex = transactions[1].toString('hex');

  console.info('Sending spell transaction:', spellTransactionHex);
  const spellTxid = await bitcoinClient.transmitTransaction(spellTransactionHex);
  console.info('spellTxid:', spellTxid);

  return [commitmentTxid, spellTxid];
}
