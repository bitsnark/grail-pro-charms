import { logger } from '../core/logger';
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
import { bufferReplacer } from '../core/json';

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

	const previousSpellData = await showSpell(context, previousNftTxid);
	logger.debug('Previous NFT spell: ', previousSpellData);
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
