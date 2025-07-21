import { createUpdateNftSpell } from './create-update-nft-spell';
import { getPreviousGrailState, injectSignaturesIntoSpell, signSpell, transmitSpell } from './spell-operations';

export default {
  getPreviousGrailState,
  signSpell,
  injectSignaturesIntoSpell,
  transmitSpell,
  createUpdateNftSpell
};
