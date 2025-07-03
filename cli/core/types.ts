
export enum PegType {
    DEPLOY = 0,
    MINT = 1,
    BURN = 2
}

export interface Utxo {
    txid: string;
    vout: number;
    value: number;
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
    previousUtxo: Utxo;
}



//     userBtcUtxo?: Utxo;
//     userCharmsWalletAddress?: string;
//     userCharmsUtxo?: Utxo;
//     userBtcWalletAddress?: string;

//     userPaymentCosignerState?: GrailState;    
//     recoveryPublicKey?: Buffer;
//     recoveryBlocks?: number;
//     userPaymentAddress?: string;
//     userPaymentSpendingScript?: Buffer;
//     userPaymentControlBlock?: Buffer;

//     lockedFundsCosignerState?: GrailState;
//     lockedFundsAddress?: string;
// }
