/* Foobah 1.0.0 */

import { createGeneralizedSpell } from './api/create-generalized-spell';
import { createPeginSpell } from './api/create-pegin-spell';
import { createPegoutSpell } from './api/create-pegout-spell';
import { createTransferSpell } from './api/create-transfer-spell';
import { createUpdateNftSpell } from './api/create-update-nft-spell';
import {
	getPreviousGrailState,
	getPreviousTransactions,
	injectSignaturesIntoSpell,
	signAsCosigner,
	filterValidCosignerSignatures,
	transmitSpell,
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
	createTransferSpell,
	filterValidCosignerSignatures,
	createGeneralizedSpell,
	transmitSpell,
};
