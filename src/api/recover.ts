import { schnorr } from '@noble/curves/secp256k1';
import { UserPaymentDetails } from '../../dist/src/core/types';
import { txidToHash } from '../core/bitcoin';
import { signTransactionInput } from '../core/spells';
import { generateSpendingScriptsForUserPayment } from '../core/taproot';
import { bitcoinjslibNetworks, Network } from '../core/taproot/taproot-common';
import * as bitcoin from 'bitcoinjs-lib';

export async function createRecoveryTransaction(
	userPaymentDetails: UserPaymentDetails,
	reoveryPrivateKey: Buffer,
	amount: number,
	network: Network,
	fee: number
): Promise<Buffer> {
	const ss = generateSpendingScriptsForUserPayment(userPaymentDetails, network);
	const script = ss.recovery.script;
	const conrolBlock = ss.recovery.controlBlock;
	const tx = new bitcoin.Transaction();
	tx.addInput(txidToHash(userPaymentDetails.txid), userPaymentDetails.vout);
	tx.ins[0].witness = [script, conrolBlock];
	tx.outs[0] = {
		script: bitcoin.address.toOutputScript(
			userPaymentDetails.userWalletAddress,
			bitcoinjslibNetworks[network]
		),
		value: amount - fee,
	};

	const sighash = tx.hashForWitnessV1(
		0,
		previous.map(p => p.script),
		previous.map(p => p.value),
		sighashType,
		tapleafHash
	);

	const signature = Buffer.from(schnorr.sign(sighash, reoveryPrivateKey));

	return tx.toBuffer();
}
