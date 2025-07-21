import { Spell, Utxo } from './types';
import { exec } from 'child_process';
import * as yaml from 'js-yaml';
import { IContext } from './i-context';
import { parse } from './env-parser';

function executeCommand(
	context: IContext,
	command: string[],
	stdin: string = '',
	pwd?: string
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		console.info(`Executing command: ${command.join(' ')}`);
		const child = exec(
			[
				pwd ? `cd ${pwd}` : '',
				'export RUST_BACKTRACE=full',
				`export USE_MOCK_PROOF=${context.mockProof ? 'true' : 'false'}`,
				command.filter(Boolean).join(' '),
			]
				.filter(Boolean)
				.join(' && '),
			(error, stdout, stderr) => {
				if (error) {
					console.error(`Execution error: ${error.message}`);
					reject(error);
				}
				if (stderr) {
					console.error(`Stderr: ${stderr}`);
				}
				console.info(`Executed successfully: ${stdout}`);
				resolve(stdout);
			}
		);
		if (stdin) {
			console.info(`Sending stdin: ${stdin}`);
			child.stdin!.write(stdin);
			child.stdin!.end();
		}
	}).catch((error: Error) => {
		console.error('Execution error:', error);
		throw error;
	});
}

export async function getVerificationKey(context: IContext): Promise<string> {
	const command = [context.charmsBin, 'app vk'];
	const zkappFolder = parse.string('ZKAPP_FOLDER', './zkapp');
	return (await executeCommand(context, command, '', zkappFolder)).trim();
}

export async function executeSpell(
	context: IContext,
	fundingUtxo: Utxo,
	changeAddress: string,
	yamlStr: any,
	previousTransactions: Buffer[] = []
): Promise<Spell> {
	const command = [
		context.charmsBin,
		'spell prove',
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

	return await executeCommand(context, command, yamlStr).then(result => {
		// Result could have some irrelevant garbage?
		const resultLines = result.split('\n').filter(line => line.trim() !== '');
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
	transactionHex: string,
	previousTransactions: Buffer[] = []
): Promise<any> {
	const command = [
		context.charmsBin,
		'tx show-spell',
		`--tx ${transactionHex}`,
		previousTransactions?.length
			? `--prev-txs ${previousTransactions.map(tx => tx.toString('hex')).join(',')}`
			: undefined,
	].filter(Boolean) as string[];

	const stdout = await executeCommand(context, command);
	return yaml.load(stdout);
}
