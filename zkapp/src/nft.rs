use charms_sdk::data::{app_datas, check, App, Data, Transaction, B32};
use sha2::{Digest, Sha256};

use crate::{common::check_previous_nft, objects::NftData};

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

pub fn nft_deploy_satisfied(app: &App, tx: &Transaction, _pub_in: &Data, priv_in: &Data) -> bool {
    // Deploy has no inputs and one output.
    check!(tx.ins.len() == 0);
    check!(tx.outs.len() == 1);

    let w_str: Option<String> = priv_in.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // can only mint an NFT with this contract if the hash of `w` is the identity of the NFT.
    check!(hash(&w_str) == app.identity);

    let nft_charms = app_datas(app, tx.outs.iter()).collect::<Vec<_>>();

    // the NFT has the correct structure.
    check!(nft_charms[0].value::<NftData>().is_ok());

    // Get the NFT data from the first output
    let Some(nft_data): Option<NftData> = nft_charms[0].value::<NftData>().ok() else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners

    true
}

pub fn nft_update_satisfied(app: &App, tx: &Transaction) -> bool {
    // Update has at least one input and one output.
    check!(tx.ins.len() >= 1);
    check!(tx.outs.len() >= 1);

    // Check that at least one input is an NFT with the same APP_ID and APP_VK
    check_previous_nft(app, tx);

    let nft_charms = app_datas(app, tx.outs.iter()).collect::<Vec<_>>();

    // the NFT has the correct structure.
    check!(nft_charms[0].value::<NftData>().is_ok());

    // Get the NFT data from the first output
    let Some(nft_data): Option<NftData> = nft_charms[0].value::<NftData>().ok() else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    // Ensure the threshold is greater than zero
    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    // There must be enough cosigners to meet the threshold
    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners

    true
}
