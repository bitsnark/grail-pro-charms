import minimist from 'minimist';
import dotenv from 'dotenv';
import * as secp from '@bitcoinerlab/secp256k1';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'crypto';
import { bufferReplacer } from '../core/json';
import { array } from '../core/array-utils';
import { setupLog } from '../core/log';

interface Keypair {
	publicKey: Buffer;
	privateKey: Buffer;
}

export function publicFromPrivate(privateKey: Buffer): Buffer {
	if (!secp.isPrivate(privateKey)) {
		throw new Error('Invalid private key');
	}
	const publicKey = secp.xOnlyPointFromScalar(privateKey);
	if (!publicKey) {
		throw new Error('Failed to derive public key');
	}
	return Buffer.from(publicKey);
}

export function privateToKeypair(privateKey: Buffer): Keypair {
	if (!secp.isPrivate(privateKey)) {
		throw new Error('Invalid private key');
	}
	const publicKey = publicFromPrivate(privateKey);
	return {
		publicKey: Buffer.from(publicKey),
		privateKey: Buffer.from(privateKey),
	};
}

export function generateRandomKeypair(): Keypair {
	// Generate a random private key
	const privateKey = randomBytes(32);
	return privateToKeypair(privateKey);
}

export function generateRandomKeypairs(size: number): Keypair[] {
	return array(size, generateRandomKeypair);
}

function main() {
	dotenv.config({ path: ['.env.test', '.env.local', '.env'] });
	setupLog();

	const argv = minimist(process.argv.slice(2), {
		alias: { c: 'count' },
		'--': true,
	});

	if (argv.count === undefined) {
		console.error('Parameter --count is required');
		return;
	}

	// Generate the random roster
	const roster = generateRandomKeypairs(argv.count || 1);
	// Print the roster
	console.log(JSON.stringify(roster, bufferReplacer, '\t'));
}

if (require.main === module) {
	main();
}
