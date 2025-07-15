export interface IConfig {
	appId: string;
	appVk: string;
	firstNftTxid: string;
	latestNftTxid: string;

	ticker: string;

	deployerPublicKey: string;
	deployerPrivateKey: string;
	network: string;
	feerate: number;
	userWalletAddress: string;
	userTimelockBlocks: number;
}
