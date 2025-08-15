use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct NftData {
    pub ticker: Option<String>,
    pub name: Option<String>,
    pub image: Option<String>,
    pub url: Option<String>,
    pub current_cosigners: String,
    pub current_threshold: u32,
}
