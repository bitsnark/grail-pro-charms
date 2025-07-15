import { Buffer } from 'node:buffer';
import { randomBytes } from 'crypto';
import minimist from 'minimist';
import * as secp from '@bitcoinerlab/secp256k1';
import { bufferReplacer } from '../core/json';
import { array } from '../core/array-utils';

interface Keypair {
	publicKey: Buffer;
	privateKey: Buffer;
}

export function generateRandomKeypair(): Keypair {
	// Generate a random private key
	const privateKey = randomBytes(32);
	// Ensure the private key is valid
	if (!secp.isPrivate(privateKey)) {
		throw new Error('Invalid private key generated');
	}
	// Derive the public key from the private key
	const publicKey = secp.xOnlyPointFromScalar(privateKey);
	if (!publicKey) {
		throw new Error('Failed to derive public key');
	}
	return { publicKey: Buffer.from(publicKey), privateKey: privateKey };
}

export function generateRandomKeypairs(size: number): Keypair[] {
	return array(size, generateRandomKeypair);
}

function main() {
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
