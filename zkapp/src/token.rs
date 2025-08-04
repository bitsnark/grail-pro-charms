use crate::common::check_previous_nft;
use charms_sdk::data::{App, Transaction};

pub fn token_mint_satisfied(token_app: &App, tx: &Transaction) -> bool {
    check_previous_nft(token_app, tx);
    true
}

pub fn token_transmit_satisfied(token_app: &App, tx: &Transaction) -> bool {
    // TODO: Implement the logic for token transfer
    true
}
