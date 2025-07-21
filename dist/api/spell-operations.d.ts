import { SignaturePackage, Spell, UpdateRequest } from '../core/types';
import { KeyPair } from '../core/taproot';
import { GrailState, UserPaymentDetails } from '../core/types';
import { IContext } from '../core/i-context';
export declare function getPreviousGrailState(context: IContext, previousNftTxid: string): Promise<GrailState>;
export declare function createUpdatingSpell(context: IContext, request: UpdateRequest, previousTxIds: string[], previousGrailState: GrailState, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails | null): Promise<Spell>;
export declare function signSpell(context: IContext, spell: Spell, previousNftTxid: string, nextGrailState: GrailState, userPaymentDetails: UserPaymentDetails | null, keyPairs: KeyPair[]): Promise<SignaturePackage>;
export declare function injectSignaturesIntoSpell(context: IContext, spell: Spell, previousNftTxid: string, signaturePackage: SignaturePackage): Promise<Spell>;
export declare function transmitSpell(context: IContext, transactions: Spell): Promise<[string, string]>;
