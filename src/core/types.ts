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
		vout: parseInt(parts[1], 10),
	};
}

export interface GrailState {
	publicKeys: string[];
	threshold: number;
}

export interface CharmerRequest {
	appId?: string;
	appVk?: string;

	// For the commitment
	fundingUtxo: Utxo;
	fundingChangeAddress: string;
	feerate: number;

	toYamlObj(): any;
}

export interface NftRequest extends CharmerRequest {
	// NFT chain
	ticker: String;
	previousUtxo?: Utxo;
	nextNftAddress: string;
	currentNftState: { publicKeysAsString: string; threshold: number };
}

export interface DeployRequest extends NftRequest {}

export interface UpdateRequest extends NftRequest {
	previousNftTxid: string;
	previousGrailState: GrailState;
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

export const generalizeInfoBlank: GeneralizedInfo = {
	incomingUserBtc: [],
	incomingGrailBtc: [],
	incomingUserCharms: [],
	outgoingUserBtc: [],
	outgoingUserCharms: [],
};

export interface GeneralizedRequest extends UpdateRequest {
	generalizedInfo: GeneralizedInfo;
}

export interface LabeledSignature {
	publicKey: string; // Public key in hex format
	signature: Buffer; // Signature in hex format
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

export type PreviousTransactions = { [key: string]: Buffer };

export interface SignatureRequest {
	transactionBytes: Buffer;
	previousTransactions: PreviousTransactions;
	inputs: { index: number; state: GrailState; script: Buffer }[];
}

export type CosignerSignatures = { index: number; signature: Buffer };

export interface SignatureResponse {
	publicKey: string;
	signatures: CosignerSignatures[];
}
