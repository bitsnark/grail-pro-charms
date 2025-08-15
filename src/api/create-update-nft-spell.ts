import { logger } from '../core/logger';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import {
	GeneralizedInfo,
	GrailState,
	SignatureRequest,
	Spell,
	Utxo,
} from '../core/types';
import { createGeneralizedSpell } from './create-generalized-spell';
import { parse } from '../core/env-parser';

export async function createUpdateNftSpell(
	context: IContext,
	feerate: number,
	previousNftTxid: string,
	grailState: GrailState,
	fundingUtxo?: Utxo
): Promise<{ spell: Spell; signatureRequest: SignatureRequest }> {
	if (!fundingUtxo) {
		const defaultTransactionSize = parse.number(
			'BTC_DEFAULT_TRANSACTION_SIZE',
			250
		);
		fundingUtxo = await context.bitcoinClient.getFundingUtxo(
			feerate * defaultTransactionSize
		);
	}

	const previousSpellData = await showSpell(context, previousNftTxid);
	logger.debug('Previous NFT spell: ', previousSpellData);
	if (!previousSpellData) {
		throw new Error('Invalid previous NFT spell data');
	}

	// Create a fresh copy of generalizeInfoBlank to avoid mutation issues
	const freshGeneralizedInfo: GeneralizedInfo = {
		incomingUserBtc: [],
		incomingGrailBtc: [],
		incomingUserCharms: [],
		outgoingUserBtc: [],
		outgoingUserCharms: [],
	};

	return await createGeneralizedSpell(
		context,
		feerate,
		previousNftTxid,
		grailState,
		freshGeneralizedInfo,
		{},
		fundingUtxo
	);
}
