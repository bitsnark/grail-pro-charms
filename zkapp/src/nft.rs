use charms_sdk::data::{app_datas, check, App, Data, Transaction, UtxoId, B32, NFT, TOKEN};
use sha2::{Digest, Sha256};

use crate::objects::{NftData, TransactionType, XBTCData};

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

pub fn nft_deploy_satisfied(app: &App, tx: &Transaction, pub_in: &Data, priv_in: &Data) -> bool {

    // Deploy has no inputs and one output.
    check!(tx.ins.len() == 0);
    check!(tx.outs.len() == 1);

    let w_str: Option<String> = priv_in.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // can only mint an NFT with this contract if the hash of `w` is the identity of the NFT.
    check!(hash(&w_str) == app.identity);

    let nft_charms = app_datas(app, tx.outs.iter()).collect::<Vec<_>>();

    // can mint exactly one NFT.
    check!(nft_charms.len() == 1);

    // the NFT has the correct structure.
    check!(nft_charms[0].value::<NftData>().is_ok());

    // Get the NFT data from the first output
    let Some(nft_data): Option<NftData> = nft_charms[0].value::<NftData>().ok() else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    eprintln!("Ticker: {}", nft_data.ticker);
    eprintln!("Threshold: {}", nft_data.current_threshold);

    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    eprintln!("Cosigners: {:?}", cosigners);

    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners

    true
}

pub fn nft_update_satisfied(app: &App, tx: &Transaction) -> bool {

    check!(tx.ins.len() == 1); // Ensure there is exactly one input
    check!(tx.outs.len() == 1); // Ensure there is exactly one output

    let nft_charms = app_datas(app, tx.outs.iter()).collect::<Vec<_>>();

    // can mint exactly one NFT.
    check!(nft_charms.len() == 1);

    // the NFT has the correct structure.
    check!(nft_charms[0].value::<NftData>().is_ok());

    // Get the NFT data from the first output
    let Some(nft_data): Option<NftData> = nft_charms[0].value::<NftData>().ok() else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    eprintln!("Ticker: {}", nft_data.ticker);
    eprintln!("Threshold: {}", nft_data.current_threshold);

    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    eprintln!("Cosigners: {:?}", cosigners);

    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners

    true
}
