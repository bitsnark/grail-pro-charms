
export enum PegType {
    DEPLOY = 0,
    MINT = 1,
    BURN = 2
}

export interface Utxo {
    txid: string;
    vout: number;
    value?: number;
}

export function utxoFromUtxoId(str: string): Utxo {
    const parts = str.split(':');
    if (parts.length !== 2) {
        throw new Error(`Invalid UTXO ID format: ${str}`);
    }
    return {
        txid: parts[0],
        vout: parseInt(parts[1], 10)
    };  
}

export interface GrailState {
    publicKeys: string; // Comma-separated list of public keys in hex format
    threshold: number;
}

export interface CharmerRequest {

    appId?: string;
    appVk?: string;

    // For the commitment
    fundingUtxo: Utxo;
    fundingChangeAddress: string;
    feeRate: number;

    toYamlObj(): any;
}

export interface NftRequest extends CharmerRequest {
    // NFT chain
    previousUtxo?: Utxo;
    nextNftAddress: string;
    currentNftState: GrailState;
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
    publicKey: string; // Public key in hex format
    signature: Buffer; // Signature in hex format
}
