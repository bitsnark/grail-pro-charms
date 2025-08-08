import { logger } from './logger';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { Spell, SpellMetadata, Utxo } from './types';
import { exec } from 'child_process';
import { IContext } from './i-context';
import { parse } from './env-parser';

function executeCommand(
	context: IContext,
	command: string[],
	pwd?: string
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		logger.info(`Executing command: ${command.join(' ')}`);
		exec(
			[
				pwd ? `cd ${pwd}` : '',
				'export RUST_BACKTRACE=full',
				`export USE_MOCK_PROOF=${context.mockProof ? 'true' : 'false'}`,
				`export SKIP_PROOF=${context.skipProof ? 'true' : 'false'}`,
				command.filter(Boolean).join(' '),
			]
				.filter(Boolean)
				.join(' && '),
			(error, stdout, stderr) => {
				if (error) {
					logger.error(`Execution error: ${error.message}`);
					reject(error);
				}
				if (stderr) {
					logger.warn(`Stderr: ${stderr}`);
				}
				if (stdout) logger.debug(stdout);
				resolve(stdout);
			}
		);
	}).catch((error: Error) => {
		logger.error('Execution error: ', error);
		throw error;
	});
}

export async function getVerificationKey(context: IContext): Promise<string> {
	const command = [context.charmsBin, 'app vk'];
	const zkappFolder = parse.string('ZKAPP_FOLDER', './zkapp');
	return (await executeCommand(context, command, zkappFolder)).trim();
}

export async function executeSpell(
	context: IContext,
	fundingUtxo: Utxo,
	feerate: number,
	changeAddress: string,
	yamlStr: string,
	previousTransactions: Buffer[] = []
): Promise<Spell> {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'charms-'));
	const tempFile = path.join(tempDir, 'spell.yaml');
	fs.writeFileSync(tempFile, yamlStr, 'utf8');

	const command = [
		context.charmsBin,
		'spell prove',
		`--spell ${tempFile}`,
		`--fee-rate ${Math.round(feerate * 1e8)}`, // Convert to satoshis
		`--app-bins ${context.zkAppBin}`,
		`--funding-utxo ${fundingUtxo.txid}:${fundingUtxo.vout}`,
		`--funding-utxo-value ${fundingUtxo.value}`,
		`--change-address ${changeAddress}`,
		previousTransactions?.length
			? `--prev-txs ${previousTransactions.map(tx => tx.toString('hex')).join(',')}`
			: undefined,
		context.temporarySecret
			? `--temporary-secret-str ${context.temporarySecret.toString('hex')}`
			: undefined,
	].filter(Boolean) as string[];

	return await executeCommand(context, command).then(result => {
		// Result could have some irrelevant garbage?
		const resultLines = result
			.split('\n')
			.map(s => s.trim())
			.filter(Boolean);
		const obj = JSON.parse(resultLines.pop() ?? '');
		if (!Array.isArray(obj)) {
			throw new Error('Spell execution did not return an array');
		}
		const a = obj.map((item: string) => Buffer.from(item, 'hex'));
		if (a.length !== 2) {
			throw new Error(
				'Spell execution did not return exactly two transactions'
			);
		}
		return {
			commitmentTxBytes: a[0],
			spellTxBytes: a[1],
		} as Spell;
	});
}

export async function showSpell(
	context: IContext,
	txid: string
): Promise<SpellMetadata> {
	const txhex = await context.bitcoinClient.getTransactionHex(txid);
	const command = [context.charmsBin, 'tx show-spell', `--tx ${txhex}`].filter(
		Boolean
	) as string[];

	const stdout = await executeCommand(context, command);
	return yaml.load(stdout) as SpellMetadata;
}
