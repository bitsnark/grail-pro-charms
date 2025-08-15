import { logger } from '../core/logger';
import { SignatureRequest, Spell, TokenDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
import { createGeneralizedSpell } from './create-generalized-spell';
import { getFundingUtxo, getPreviousGrailState } from './spell-operations';

export async function createMintSpell(
	context: IContext,
	tokenDetails: TokenDetails,
	feerate: number,
	previousNftTxid: string,
	amount: number,
	userWalletAddress: string,
	fundingUtxo?: Utxo
): Promise<{ spell: Spell; signatureRequest: SignatureRequest }> {
	const previousNftTxhex =
		await context.bitcoinClient.getTransactionHex(previousNftTxid);
	if (!previousNftTxhex) {
		throw new Error(`Previous NFT transaction ${previousNftTxid} not found`);
	}

	const previousGrailState = await getPreviousGrailState(
		context,
		previousNftTxid
	);
	if (!previousGrailState) {
		throw new Error('Previous Grail state not found');
	}

	if (!fundingUtxo)
		fundingUtxo = await getFundingUtxo(context.bitcoinClient, feerate);

	const { spell, signatureRequest } = await createGeneralizedSpell(
		context,
		feerate,
		previousNftTxid,
		previousGrailState,
		{
			disableSanity: true, // Disable sanity check for minting
			incomingUserBtc: [],
			incomingUserCharms: [],
			incomingGrailBtc: [],
			outgoingUserCharms: [
				{
					amount: amount,
					address: userWalletAddress,
				},
			],
			outgoingUserBtc: [],
		},
		tokenDetails,
		fundingUtxo
	);

	logger.debug('Mint spell created: ', spell);

	return { spell, signatureRequest };
}
