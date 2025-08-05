import { logger } from './logger';
import * as bitcoin from 'bitcoinjs-lib';
import * as yaml from 'js-yaml';
import { schnorr } from '@noble/curves/secp256k1';
import { executeSpell } from './charms-sdk';
import { CharmerRequest, GrailState, Spell, TokenUtxo, Utxo } from './types';
import { bufferReplacer } from './json';
import { KeyPair } from './taproot';
import { getHash } from './taproot/taproot-common';
import { showSpell } from './charms-sdk';
import { IContext } from './i-context';
import { hashToTxid } from './bitcoin';
import { arrayFromArrayWithIndex, mapAsync } from './array-utils';

// SIGHASH type for Taproot (BIP-342)
const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;

export async function getStateFromNft(
	context: IContext,
	nftTxId: string
): Promise<GrailState | null> {
	const previousSpellData = await showSpell(context, nftTxId);
	logger.debug('NFT Spell: ', previousSpellData);
	if (
		!previousSpellData ||
		!previousSpellData.outs ||
		previousSpellData.outs.length < 1
	) {
		return null;
	}
	const nftId = `n/${context.appId}/${context.appVk}`;
	const appKey = Object.keys(previousSpellData.apps).find(
		key => previousSpellData.apps[key] === nftId
	);
	if (!appKey || !previousSpellData.outs[0].charms[appKey]) {
		return null;
	}
	const previousPublicKeys =
		previousSpellData.outs[0].charms[appKey].current_cosigners?.split(',');
	const previousThreshold =
		previousSpellData.outs[0].charms[appKey].current_threshold;

	return {
		publicKeys: previousPublicKeys,
		threshold: previousThreshold,
	};
}

export async function getCharmsAmountFromUtxo(
	context: IContext,
	utxo: Utxo
): Promise<number> {
	const tokenId = `t/${context.appId}/${context.appVk}`;
	const spellData = await showSpell(context, utxo.txid);
	if (!spellData || !spellData.outs) {
		throw new Error(`No spell data found for UTXO ${utxo.txid}`);
	}
	const appKey = Object.keys(spellData.apps).find(
		key => spellData.apps[key] === tokenId
	);
	if (!appKey) {
		throw new Error(`No app key found for token ${tokenId}`);
	}
	return Number(spellData.outs[utxo.vout]?.charms[appKey] ?? 0);
}

export function signTransactionInput(
	context: IContext,
	txBytes: Buffer,
	inputIndex: number,
	script: Buffer,
	previousTxBytesMap: { [txid: string]: Buffer },
	keypair: KeyPair
): Buffer {
	// Load the transaction to sign
	const tx = bitcoin.Transaction.fromBuffer(txBytes);

	// Tapleaf version for tapscript is always 0xc0
	// BitcoinJS v6+ exposes tapleafHash for this calculation
	const tapleafHash = getHash(script);

	const previous: { value: number; script: Buffer }[] = [];
	for (const input of tx.ins) {
		const inputTxid = hashToTxid(input.hash);
		const ttxbytes = previousTxBytesMap[inputTxid];
		if (!ttxbytes) throw new Error(`Input transaction ${inputTxid} not found`);
		const ttx = bitcoin.Transaction.fromBuffer(ttxbytes);
		const out = ttx.outs[input.index];
		previous.push({
			value: out.value,
			script: out.script,
		});
	}

	// Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
	const sighash = tx.hashForWitnessV1(
		inputIndex,
		previous.map(p => p.script),
		previous.map(p => p.value),
		sighashType,
		tapleafHash
	);

	return Buffer.from(schnorr.sign(sighash, keypair.privateKey));
}

export function verifySignatureForTransactionInput(
	context: IContext,
	txBytes: Buffer,
	signature: Buffer,
	inputIndex: number,
	script: Buffer,
	previousTxBytesMap: { [txid: string]: Buffer },
	publicKey: Buffer
): boolean {
	// Load the transaction to sign
	const tx = bitcoin.Transaction.fromBuffer(txBytes);

	// Tapleaf version for tapscript is always 0xc0
	// BitcoinJS v6+ exposes tapleafHash for this calculation
	const tapleafHash = getHash(script);

	const previous: { value: number; script: Buffer }[] = [];
	for (const input of tx.ins) {
		const inputTxid = hashToTxid(input.hash);
		const ttxbytes = previousTxBytesMap[inputTxid];
		if (!ttxbytes) throw new Error(`Input transaction ${inputTxid} not found`);
		const ttx = bitcoin.Transaction.fromBuffer(ttxbytes);
		const out = ttx.outs[input.index];
		previous.push({
			value: out.value,
			script: out.script,
		});
	}

	// Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
	const sighash = tx.hashForWitnessV1(
		inputIndex,
		previous.map(p => p.script),
		previous.map(p => p.value),
		sighashType,
		tapleafHash
	);

	return schnorr.verify(signature, sighash, publicKey);
}

export async function resignSpellWithTemporarySecret(
	context: IContext,
	spellTxBytes: Buffer,
	previousTxBytesMap: { [txid: string]: Buffer },
	temporarySecret: Buffer
): Promise<Buffer> {
	// Load the transaction to sign
	const tx = bitcoin.Transaction.fromBuffer(spellTxBytes);
	const inputIndex = tx.ins.length - 1; // Last input is the commitment

	const previous: { value: number; script: Buffer }[] = [];
	for (const input of tx.ins) {
		let ttxBytes: Buffer;
		const inputTxid = hashToTxid(input.hash);
		if (previousTxBytesMap[inputTxid]) {
			ttxBytes = previousTxBytesMap[inputTxid];
		} else {
			const ttxHex = await context.bitcoinClient.getTransactionHex(inputTxid);
			if (!ttxHex) {
				throw new Error(`Input transaction ${inputTxid} not found`);
			}
			ttxBytes = Buffer.from(ttxHex, 'hex');
		}
		const ttx = bitcoin.Transaction.fromBuffer(ttxBytes);
		const out = ttx.outs[input.index];
		previous.push({
			value: out.value,
			script: out.script,
		});
	}

	const script = tx.ins[inputIndex].witness[1]; // Tapleaf script
	const tapleafHash = getHash(script);

	// Compute sighash for this tapleaf spend (see https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/taproot.spec.ts)
	const sighash = tx.hashForWitnessV1(
		inputIndex,
		previous.map(p => p.script),
		previous.map(p => p.value),
		sighashType,
		tapleafHash
	);

	const signature = schnorr.sign(sighash, temporarySecret);
	const temporaryPublicKey = schnorr.getPublicKey(temporarySecret);
	if (!schnorr.verify(signature, sighash, temporaryPublicKey)) {
		throw new Error('Temporary signature verification failed');
	}

	tx.ins[inputIndex].witness[0] = Buffer.from(signature);

	return tx.toBuffer();
}

export async function createSpell(
	context: IContext,
	previousTxids: string[],
	request: CharmerRequest
): Promise<Spell> {
	logger.debug('Creating spell...');

	const previousTransactions = await Promise.all(
		previousTxids.map(async txid =>
			context.bitcoinClient.getTransactionHex(txid)
		)
	);
	const yamlStr = yaml.dump(request.toYamlObj());
	logger.debug('Executing spell creation with Yaml: ', yamlStr);
	const output = await executeSpell(
		context,
		request.fundingUtxo,
		request.feerate,
		request.fundingChangeAddress,
		yamlStr,
		previousTransactions.map(tx => Buffer.from(tx, 'hex'))
	);

	logger.debug('Spell created successfully: ', output);

	return {
		commitmentTxBytes: output.commitmentTxBytes,
		spellTxBytes: output.spellTxBytes,
	};
}

export async function findCharmsUtxos(
	context: IContext,
	minTotal: number,
	utxos?: Utxo[]
): Promise<TokenUtxo[]> {
	let total = 0;
	if (!utxos) {
		utxos = await context.bitcoinClient.listUnspent();
	}
	if (utxos.length === 0) {
		throw new Error('No UTXOs found');
	}
	const charmsUtxos = (
		await mapAsync(utxos, async utxo => {
			logger.debug('Checking UTXO: ', utxo);
			if (total >= minTotal) return { ...utxo, amount: 0 };
			const amount =
				(await getCharmsAmountFromUtxo(context, utxo).catch(_ => {})) ?? 0;
			if (amount <= 0) return { ...utxo, amount: 0 };
			logger.info('Charms UTXO found: ', utxo, amount);
			total += amount;
			return { ...utxo, amount: amount };
		})
	).filter(t => t.amount > 0);
	return charmsUtxos;
}
