use charms_sdk::data::{check, App, Transaction};
use std::cmp::Ordering;

// At least one of the inputs should be for an NFT with the same APP_ID and APP_VK
pub fn check_previous_nft(token_app: &App, tx: &Transaction) -> bool {
    let mut flag = false;
    tx.ins.iter().for_each(|input| {
        let map = input.1;
        map.iter().for_each(|(app, _v)| {
            if app.tag == 'n'
                && app.identity.cmp(&token_app.identity) == Ordering::Equal
                && app.vk.cmp(&token_app.vk) == Ordering::Equal
            {
                flag = true;
            }
        });
    });
    check!(flag);
    true
}
