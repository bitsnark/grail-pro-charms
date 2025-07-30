import { Network } from '../core/taproot/taproot-common';
import { IContext } from '../core/i-context';
export declare function sendUserPaymentCharms(context: IContext, currentPublicKeys: string[], currentThreshold: number, amount: number, network: Network): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
export declare function sendUserPaymentBtc(currentPublicKeys: string[], currentThreshold: number, amount: number, network: Network): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
export declare function userPaymentCli(_argv: string[]): Promise<{
    txid: string;
    recoveryPublicKey: string;
}>;
