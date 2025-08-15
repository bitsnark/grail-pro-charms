import { TransactionInfoMap } from '../../src/visualize/types';
import { hashToTxid } from '../core/bitcoin';

export interface NftMeta {
	ticker: string;
	name: string;
	image: string;
	url: string;
}

export function getNftMeta(
	transactionInfoMap: TransactionInfoMap,
	nftId: string
): NftMeta | undefined {
	let currentNftId = nftId;
	let nftMeta: NftMeta | undefined;
	while (currentNftId) {
		const transactionInfo = transactionInfoMap[currentNftId];
		if (!transactionInfo?.spell?.apps || !transactionInfo?.spell?.outs) break;
		if (
			transactionInfo.spell.outs[0] &&
			transactionInfo.spell.outs[0].charms &&
			transactionInfo.spell.outs[0].charms['$0000']
		)
			nftMeta = transactionInfo.spell?.outs[0].charms['$0000'] as NftMeta;
		currentNftId = hashToTxid(transactionInfo.tx.ins[0].hash);
	}
	return nftMeta;
}
