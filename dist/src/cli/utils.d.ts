import minimist from 'minimist';
import { GrailState, UserPaymentDetails } from '../core/types';
import { IContext } from '../core/i-context';
export declare function getNewGrailStateFromArgv(argv: minimist.ParsedArgs): GrailState;
export declare function getUserPaymentFromArgv(argv: minimist.ParsedArgs): UserPaymentDetails;
export declare function createContext(argv: minimist.ParsedArgs): Promise<IContext>;
