import { executeSpell } from './charms-sdk';
import { CharmerRequest } from './types';
import { BitcoinClient } from './bitcoin';
import * as yaml from 'js-yaml';

export async function createSpell(
  bitcoinClient: BitcoinClient,
  previousTxids: string[],
  request: CharmerRequest
): Promise<Buffer[]> {

  const previousTransactions = await Promise.all(previousTxids.map(async (txid) => bitcoinClient.getTransactionHex(txid)));
  const yamlStr = yaml.dump(request.toYamlObj()); // toYaml(request.toYamlObj());
  const output = await executeSpell(
    request.fundingUtxo,
    request.fundingChangeAddress,
    yamlStr,
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
