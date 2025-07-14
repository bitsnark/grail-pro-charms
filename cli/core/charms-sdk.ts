import { Spell, Utxo } from './types';
import { exec } from 'child_process';
import * as yaml from 'js-yaml';

const CHARMS_PATH = './zkapp';
const APP_BINS = './target/charms-app';
const CHARMS_BIN = process.env['CHARMS_BIN'] || '~/workspace/charms/target/release/charms';

function executeCommand(command: string[], stdin: string = ''): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    console.info(`Executing command: ${command.join(' ')}`);
    const child = exec(`cd ${CHARMS_PATH} ; export RUST_BACKTRACE=full ; ${command.join(' ')}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Execution error: ${error.message}`);
        reject(error);
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.info(`Executed successfully: ${stdout}`);
      resolve(stdout);
    });
    if (stdin) {
      console.info(`Sending stdin: ${stdin}`);
      child.stdin!.write(stdin);
      child.stdin!.end();
    }
  })
    .catch((error: Error) => {
      console.error('Execution error:', error);
      throw error;
    });
}

export async function getVerificationKey(): Promise<string> {
  const command = [
    CHARMS_BIN,
    'app vk'
  ];
  return (await executeCommand(command, '')).trim();
}

export async function executeSpell(
  fundingUtxo: Utxo,
  changeAddress: string,
  yamlStr: any,
  previousTransactions: Buffer[] = [],
  temporarySecret?: Buffer
): Promise<Spell> {

  if (temporarySecret && temporarySecret.length !== 32) {
    throw new Error('Temporary secret must be a 32-byte buffer');
  }

  const command = [
    CHARMS_BIN,
    'spell prove',
    `--app-bins ${APP_BINS}`,
    `--funding-utxo ${fundingUtxo.txid}:${fundingUtxo.vout}`,
    `--funding-utxo-value ${fundingUtxo.value}`,
    `--change-address ${changeAddress}`,
    previousTransactions?.length ? `--prev-txs ${previousTransactions.map(tx => tx.toString('hex')).join(',')}` : undefined,
    temporarySecret ? `--temporary-secret-str ${temporarySecret.toString('hex')}` : undefined,
  ].filter(Boolean) as string[];

  return await executeCommand(command, yamlStr)
    .then(result => {
      // Result could have some irrelevant garbage?
      const resultLines = result.split('\n').filter(line => line.trim() !== '');
      const obj = JSON.parse(resultLines.pop() ?? '');
      if (!Array.isArray(obj)) {
        throw new Error('Spell execution did not return an array');
      }
      const a = obj.map((item: string) => Buffer.from(item, 'hex'));
      if (a.length !== 2) {
        throw new Error('Spell execution did not return exactly two transactions');
      }
      return {
        commitmentTxBytes: a[0],
        spellTxBytes: a[1]
      } as Spell;
    });
}

export async function showSpell(
  transactionHex: string,
  previousTransactions: Buffer[] = [],
): Promise<any> {

  const command = [
    CHARMS_BIN,
    'tx show-spell',
    `--tx ${transactionHex}`,
    previousTransactions?.length ? `--prev-txs ${previousTransactions.map(tx => tx.toString('hex')).join(',')}` : undefined
  ].filter(Boolean) as string[];

  const stdout = await executeCommand(command);
  return yaml.load(stdout);
}
