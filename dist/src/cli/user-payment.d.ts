import { Network } from '../core/taproot/taproot-common';
import { IContext } from '../core/i-context';
import { GrailState } from '../core/types';
export declare function sendUserPaymentCharms(context: IContext, feerate: number, grailState: GrailState, amount: number, changeAddress: string, network: Network): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
export declare function sendUserPaymentBtc(context: IContext, grailState: GrailState, amount: number, network: Network): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
export declare function userPaymentCli(_argv: string[]): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
