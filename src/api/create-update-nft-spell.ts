import { BitcoinClient } from '../core/bitcoin';
import { showSpell } from '../core/charms-sdk';
import { IContext } from '../core/i-context';
import { bufferReplacer } from '../core/json';
import {
	GeneralizedInfo,
	GrailState,
	SignatureRequest,
	Spell,
	Utxo
} from '../core/types';
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

	const previousSpellData = await showSpell(context, previousNftTxid);
	console.log(
		'Previous NFT spell:',
		JSON.stringify(previousSpellData, bufferReplacer, 2)
	);
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
		fundingUtxo
	);
}
