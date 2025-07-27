import { BitcoinClient } from '../core/bitcoin';
import {
	generalizeInfoBlank,
	GrailState,
	SignatureRequest,
	Spell,
	Utxo,
} from '../core/types';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import { createGeneralizedSpell } from './create-generalized-spell';

export async function createUpdateNftSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	grailState: GrailState,
	fundingUtxo?: Utxo
): Promise<{ spell: Spell; signatureRequest: SignatureRequest }> {
	const bitcoinClient = await BitcoinClient.initialize();

	if (!fundingUtxo) {
		fundingUtxo = await bitcoinClient.getFundingUtxo();
	}

	const previousNftTxhex =
		await bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}
	const previousSpellData = await showSpell(context, previousNftTxhex);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, null, '\t')
	);
	if (!previousSpellData) {
		throw new Error('Invalid previous NFT spell data');
	}

	return await createGeneralizedSpell(
		context,
		feerate,
		previousNftTxid,
		grailState,
		generalizeInfoBlank,
		fundingUtxo
	);
}
