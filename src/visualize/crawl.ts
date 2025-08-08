import * as bitcoin from 'bitcoinjs-lib';
import { IContext } from '../core/i-context';
import { hashToTxid } from '../core/bitcoin';
import { showSpell } from '../core/charms-sdk';
import { logger } from '../core/logger';
import { TransactionInfoMap } from './types';

export async function crawl(
	context: IContext,
	maxDepth: number,
	txid: string,
	/* out */ transactions: TransactionInfoMap = {}
): Promise<TransactionInfoMap> {
	if (maxDepth <= 0) return transactions;
	try {
		const txBytes = await context.bitcoinClient.getTransactionBytes(txid);
		if (!txBytes || txBytes.length === 0) return transactions;
		transactions[txid] = {
			txid,
			bytes: txBytes,
			tx: bitcoin.Transaction.fromBuffer(txBytes),
		};
	} catch (error) {
		logger.warn(`Error fetching transaction ${txid}:`, error);
		return transactions;
	}

	try {
		const spell = await showSpell(context, txid);
		if (!spell) return transactions;
		transactions[txid].spell = spell;
	} catch (error) {
		logger.warn(`Error showing spell for txid ${txid}:`, error);
		return transactions;
	}

	for (const input of transactions[txid].tx.ins) {
		const inputTxid = hashToTxid(input.hash);
		await crawl(context, maxDepth - 1, inputTxid, transactions);
	}

	return transactions;
}
