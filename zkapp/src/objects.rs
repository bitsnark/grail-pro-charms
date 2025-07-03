use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct RosterNFT {
    pub pubkeys: Vec<String>,
    pub new_cosigners: Option<Vec<String>>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum TransactionType {
    Mint,
    Burn,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct XBTCData {
    pub funding_utxo: String, // unique_id
    pub lock_amount: u64,
    pub change_amount: u64,
    pub change_address: String,
    pub fee: u64,
    pub action: TransactionType,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct NftData {
    pub current_cosigners: String,
    pub current_threshold: u32
}
