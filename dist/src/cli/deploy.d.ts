import { TokenDetails, Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function deployNft(context: IContext, tokenDetails: TokenDetails, deployerPublicKey: Buffer, feerate: number, fundingUtxo: Utxo, transmit?: boolean): Promise<[string, string]>;
export declare function deployNftCli(_argv: string[]): Promise<{
    appId: string;
    appVk: string;
    spellTxid: string;
}>;
