use charms_sdk::data::{app_datas, check, App, Data, Transaction, UtxoId, NFT, TOKEN};

use crate::objects::{RosterNFT, TransactionType, XBTCData};

pub mod objects;

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    match app.tag {
        TOKEN => {
            check!(token_contract_satisfied(app, tx, x, w))
        }
        NFT => {
            check!(nft_contract_satisfied(app, tx, x, w))
        }
        _ => {
            unreachable!()
        }
    }

    true
}

fn token_contract_satisfied(token_app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let utxo_id = UtxoId::from_bytes(
        w.bytes()
            .as_slice()
            .try_into()
            .expect("Expected 36 bytes for utxo_id"),
    );

    let utxo_id_charms = tx.ins.get(&utxo_id).expect("UtxoId not found in `ins`!");
    let utxo_id_data = utxo_id_charms
        .get(token_app)
        .expect("Data for charms app not found!");

    let xbtc_data_in: XBTCData = utxo_id_data
        .value()
        .expect("Couldn't deserialize data into PeginData");

    match xbtc_data_in.action {
        TransactionType::Mint => {
            check!(mint_contract_satisfied(token_app, tx, x, w, xbtc_data_in));
            true
        }
        TransactionType::Burn => {
            check!(burn_contract_satisfied(token_app, tx, x, w, xbtc_data_in));
            true
        }
    }
}

fn mint_contract_satisfied(
    token_app: &App,
    tx: &Transaction,
    x: &Data,
    w: &Data,
    xbtc_data_in: XBTCData,
) -> bool {
    let locked_funds_tx =
        String::from_utf8(x.value().expect("Couldn't deserialize `locked_funds_tx`"))
            .expect("Couldn't cast bytes to String!");

    let Some(xbtc_data_out): Option<XBTCData> =
        app_datas(token_app, tx.outs.iter()).find_map(|data| data.value().ok())
    else {
        eprintln!("could not determine outgoing remaining supply");
        return false;
    };

    // Verify expected funding utxo
    check!(xbtc_data_in.funding_utxo == locked_funds_tx);

    check!(xbtc_data_in.lock_amount == xbtc_data_out.lock_amount);

    check!(xbtc_data_in.funding_utxo == xbtc_data_out.funding_utxo);
    check!(xbtc_data_in.lock_amount - xbtc_data_out.lock_amount + xbtc_data_in.fee == 0);

    true
}

fn burn_contract_satisfied(
    token_app: &App,
    tx: &Transaction,
    x: &Data,
    w: &Data,
    xbtc_data_in: XBTCData,
) -> bool {
    let Some(xbtc_data_out): Option<XBTCData> =
        app_datas(token_app, tx.outs.iter()).find_map(|data| data.value().ok())
    else {
        eprintln!("could not determine outgoing remaining supply");
        return false;
    };

    // Verify metadata hasn't changed
    check!(xbtc_data_out.change_address == xbtc_data_in.change_address);

    check!(xbtc_data_in.funding_utxo == xbtc_data_out.funding_utxo);

    // `change_amount` is left locked after requesting to unlock `lock_amount`
    //TODO: Should fees be accounted for?
    xbtc_data_out.lock_amount + xbtc_data_out.change_amount == xbtc_data_in.lock_amount
}

fn nft_contract_satisfied(nft_app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let utxo_id = UtxoId::from_bytes(
        w.bytes()
            .as_slice()
            .try_into()
            .expect("Expected 36 bytes for utxo_id"),
    );

    let utxo_id_charms = tx.ins.get(&utxo_id).expect("UtxoId not found in `ins`!");
    let utxo_id_data = utxo_id_charms
        .get(nft_app)
        .expect("Data for charms app not found!");

    let roster_nft_in: RosterNFT = utxo_id_data
        .value()
        .expect("Couldn't deserialize data into PeginData");

    let Some(roster_nft_out): Option<RosterNFT> =
        app_datas(nft_app, tx.outs.iter()).find_map(|data| data.value().ok())
    else {
        eprintln!("could not determine outgoing remaining supply");
        return false;
    };

    roster_nft_in.pubkeys == roster_nft_out.pubkeys
}
