import { executeSpell } from './charms-sdk';
import { CharmerRequest } from './types';
import { BitcoinClient } from './bitcoin';
import * as yaml from 'js-yaml';

// function toYaml(obj: any, indent: string = ''): string {
//   let str = '';
//   Object.keys(obj).forEach(key => {
//     if (typeof obj[key] === 'string') {
//       str += `${indent}${key}: ${obj[key]}\n`;
//     } else if (typeof obj[key] === 'number') {
//       str += `${indent}${key}: ${obj[key]}\n`;
//     } else if (typeof obj[key] === 'boolean') {
//       str += `${indent}${key}: ${obj[key] ? 'true' : 'false'}\n`;
//     } else if (Array.isArray(obj[key])) {
//       str += `${indent}${key}:\n`;
//       obj[key].forEach((item: any, index: number) => {
//         if (typeof item === 'string') {
//           str += `${indent}  - "${item}"\n`;
//         } else if (typeof item === 'number') {
//           str += `${indent}  - ${item}\n`;
//         } else if (typeof item === 'boolean') {
//           str += `${indent}  - ${item ? 'true' : 'false'}\n`;
//         } else if (typeof item === 'object' && item !== null) {
//           str += `${indent}  -\n`;
//           str += toYaml(item, indent + '    ');
//         }
//       });
//     } else if (typeof obj[key] === 'object' && obj[key] !== null) {
//       str += `${indent}${key}:\n`;
//       str += toYaml(obj[key], indent + '  ');
//     }
//   });
//   return str;
// }


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
