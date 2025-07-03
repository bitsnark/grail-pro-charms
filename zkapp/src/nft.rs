use charms_sdk::data::{app_datas, check, App, Data, Transaction, UtxoId, NFT, TOKEN};

use crate::objects::{NftData, TransactionType, XBTCData};

pub fn nft_deploy_satisfied(
    app: &App,
    tx: &Transaction
) -> bool {

    check!(tx.ins.len() == 0); // Ensure there are exactly zero inputs
    check!(tx.outs.len() == 1); // Ensure there is exactly one output

    let Some(nft_data): Option<NftData> = app_datas(app, tx.outs.iter())
        .next()
        .expect("Output data expected")
        .value()
        .ok()
    else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    eprintln!("Current Threshold: {}", nft_data.current_threshold);

    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    eprintln!("Current Cosigners: {:?}", cosigners);

    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners
    check!(cosigners[0].len() > 64); // Assuming cosigners are hex strings of at least 32 bytes

    true
}

pub fn nft_update_satisfied(
    app: &App,
    tx: &Transaction
) -> bool {

    check!(tx.ins.len() >= 1); // Ensure there is at least one input
    check!(tx.outs.len() >= 1); // Ensure there is at least one output

    // The first input has to be the NFT UTXO
    let nft_utxo_id = tx.ins.keys().next().expect("Expected at least one input UTXO ID");
    let nft_utxo_data = tx.ins.get(nft_utxo_id)
        .expect("NFT UTXO ID not found in `ins`")
        .get(app)
        .expect("Data for charms app not found!");

    println!("NFT UTXO ID: {:?}", nft_utxo_id);
    println!("NFT UTXO Data: {:?}", nft_utxo_data);

    let Some(nft_data): Option<NftData> = app_datas(app, tx.outs.iter())
        .next()
        .expect("Output data expected")
        .value()
        .ok()
    else {
        eprintln!("Could not find NFT data in transaction outputs");
        return false;
    };

    eprintln!("Current Threshold: {}", nft_data.current_threshold);
    eprintln!("Current Cosigners: {:?}", nft_data.current_cosigners);

    check!(nft_data.current_threshold > 0);

    // Split cosigners into a vector
    let cosigners: Vec<String> = nft_data
        .current_cosigners
        .split(',')
        .map(|s| s.to_string())
        .collect();

    eprintln!("Cosigners vector: {:?}", cosigners);

    check!(cosigners.len() >= nft_data.current_threshold as usize); // Ensure there are enough cosigners
    check!(cosigners[0].len() == 64); // Assuming cosigners are hex strings of length 64

    true
}
