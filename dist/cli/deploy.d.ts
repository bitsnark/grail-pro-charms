import { Utxo } from '../core/types';
import { IContext } from '../core/i-context';
export declare function deployNft(context: IContext, deployerPublicKey: Buffer, feeRate: number, fundingUtxo: Utxo, transmit?: boolean): Promise<void>;
