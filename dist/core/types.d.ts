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
    feerate: number;
    toYamlObj(): any;
}
export interface NftRequest extends CharmerRequest {
    ticker: String;
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
    previousGrailState: GrailState;
}
export interface TransmitRequest extends CharmerRequest {
    inputUtxos: TokenUtxo[];
    outputAddress: string;
    changeAddress: string;
    amount: number;
    changeAmount: number;
}
interface Outgoing {
    amount: number;
    address: string;
}
export interface GeneralizedInfo {
    incomingUserBtc: UserPaymentDetails[];
    incomingGrailBtc: Utxo[];
    incomingUserCharms: UserPaymentDetails[];
    outgoingUserBtc: Outgoing[];
    outgoingUserCharms: Outgoing[];
    outgoingGrailBtc?: Outgoing;
}
export declare const generalizeInfoBlank: GeneralizedInfo;
export interface GeneralizedRequest extends UpdateRequest {
    generalizedInfo: GeneralizedInfo;
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
    grailState: GrailState;
    userWalletAddress: string;
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
}[];
export interface SignatureResponse {
    publicKey: string;
    signatures: CosignerSignatures;
}
export interface TokenUtxo {
    txid: string;
    vout: number;
    amount: number;
}
export {};
