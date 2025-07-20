use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct NftData {
    pub ticker: String,
    pub current_cosigners: String,
    pub current_threshold: u32
}
