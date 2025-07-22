export interface Utxo {
    txid: string;
    vout: number;
    value?: number;
}
export declare function utxoFromUtxoId(str: string): Utxo;
export interface GrailState {
    publicKeys: string[];
    threshold: number;
}
export interface CharmerRequest {
    appId?: string;
    appVk?: string;
    fundingUtxo: Utxo;
    fundingChangeAddress: string;
    feeRate: number;
    toYamlObj(): any;
}
export interface NftRequest extends CharmerRequest {
    previousUtxo?: Utxo;
    nextNftAddress: string;
    currentNftState: {
        publicKeysAsString: string;
        threshold: number;
    };
}
export interface DeployRequest extends NftRequest {
}
export interface UpdateRequest extends NftRequest {
    previousNftTxid: string;
}
export interface PegInRequest extends UpdateRequest {
    amount: number;
    userWalletAddress: string;
}
export interface PegOutRequest extends UpdateRequest {
    amount: number;
    userWalletAddress: string;
}
export interface LabeledSignature {
    publicKey: string;
    signature: Buffer;
}
export type SignaturePackage = LabeledSignature[][];
export interface UserPaymentDetails {
    recoveryPublicKey: string;
    timelockBlocks: number;
    txid: string;
    vout: number;
}
export interface Spell {
    commitmentTxBytes: Buffer;
    spellTxBytes: Buffer;
}
export type PreviousTransactions = {
    [key: string]: Buffer;
};
export interface SignatureRequest {
    transactionBytes: Buffer;
    previousTransactions: PreviousTransactions;
    inputs: {
        index: number;
        state: GrailState;
        script: Buffer;
    }[];
}
export type CosignerSignatures = {
    index: number;
    signature: Buffer;
};
export interface SignatureResponse {
    publicKey: string;
    signatures: CosignerSignatures[];
}
