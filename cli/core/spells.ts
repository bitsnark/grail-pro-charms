import { executeSpell } from './charms-sdk';
import { CharmerRequest, Spell } from './types';
import { BitcoinClient } from './bitcoin';
import * as yaml from 'js-yaml';
import { bufferReplacer } from './json';

export async function createSpell(
  bitcoinClient: BitcoinClient,
  previousTxids: string[],
  request: CharmerRequest,
  temporarySecret?: Buffer
): Promise<Spell> {

  console.log('Creating spell...');

  const previousTransactions = await Promise.all(previousTxids.map(async (txid) => bitcoinClient.getTransactionHex(txid)));
  const yamlStr = yaml.dump(request.toYamlObj()); // toYaml(request.toYamlObj());
  const output = await executeSpell(
    request.fundingUtxo,
    request.fundingChangeAddress,
    yamlStr,
    previousTransactions.map(tx => Buffer.from(tx, 'hex')),
    temporarySecret);

  console.log('Spell created successfully:', JSON.stringify(output, bufferReplacer, '\t'));

  return output;
}

export async function transmitSpell(bitcoinClient: BitcoinClient, transactions: Spell): Promise<[string, string]> {

  console.log('Transmitting spell...');

  const commitmentTxHex = transactions.commitmentTxBytes.toString('hex');
  const signedCommitmentTxHex = await bitcoinClient.signTransaction(commitmentTxHex, undefined, 'ALL|ANYONECANPAY');

  console.info('Sending commitment transaction:', signedCommitmentTxHex);
  const commitmentTxid = await bitcoinClient.transmitTransaction(signedCommitmentTxHex);

  const spellTransactionHex = transactions.spellTxBytes.toString('hex');

  console.info('Sending spell transaction:', spellTransactionHex);
  const spellTxid = await bitcoinClient.transmitTransaction(spellTransactionHex);

  const output: [string, string] = [commitmentTxid, spellTxid];
  console.log('Spell transmitted successfully:', output);

  return output;
}
