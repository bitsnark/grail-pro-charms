import { createGeneralizedSpell } from './api/create-generalized-spell';
import { createPeginSpell } from './api/create-pegin-spell';
import { createPegoutSpell } from './api/create-pegout-spell';
import { createUpdateNftSpell } from './api/create-update-nft-spell';
import {
	getPreviousGrailState,
	getPreviousTransactions,
	injectSignaturesIntoSpell,
	signAsCosigner,
	transmitSpell,
	filterValidCosignerSignatures,
} from './api/spell-operations';
import { Context } from './core/context';

export {
	Context,
	getPreviousGrailState,
	getPreviousTransactions,
	createUpdateNftSpell,
	createPeginSpell,
	createPegoutSpell,
	signAsCosigner,
	injectSignaturesIntoSpell,
	transmitSpell,
	filterValidCosignerSignatures,
	createGeneralizedSpell
};
