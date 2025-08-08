use crate::common::check_previous_nft;
use charms_sdk::data::{check, App, Transaction, TOKEN};

pub fn token_nft_satisfied(token_app: &App, tx: &Transaction) -> bool {
    check_previous_nft(token_app, tx);
    true
}

pub fn token_transfer_satisfied(token_app: &App, tx: &Transaction) -> bool {
    check!(tx.ins.len() > 0); // Must have at least one input
    check!(tx.outs.len() == 2); // Must have 2 outputs

    let mut total_input = 0;
    let mut total_output = 0;

    tx.ins.iter().for_each(|input| {
        let map = input.1;
        map.iter().for_each(|(app, data)| {
            if app.tag != TOKEN || app.identity != token_app.identity || app.vk != token_app.vk {
                return;
            }
            let amount = data.value().ok().unwrap_or(0);
            total_input += amount;
        });
    });

    // let charms_out = app_datas(token_app, tx.outs.iter()).collect::<Vec<_>>();

    tx.outs.iter().for_each(|output| {
        output.get(token_app).map(|data| {
            let amount = data.value().ok().unwrap_or(0);
            total_output += amount;
        });
    });

    return total_input == total_output && total_input > 0;
}
