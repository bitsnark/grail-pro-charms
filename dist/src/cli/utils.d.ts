import minimist from 'minimist';
import { GrailState, UserPaymentDetails } from '../core/types';
export declare function getNewGrailStateFromArgv(argv: minimist.ParsedArgs): GrailState;
export declare function getUserPaymentFromArgv(argv: minimist.ParsedArgs): UserPaymentDetails;
