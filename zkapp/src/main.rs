#![no_main]

use std::collections::HashMap;

use charms_sdk::data::{app_datas, check, App, Data, Transaction, UtxoId, NFT, TOKEN};

use crate::nft::{nft_deploy_satisfied, nft_update_satisfied};

pub mod nft;
pub mod objects;

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    println!("app: {:?}", app);
    println!("tx.ins: {:?}", tx.ins);
    println!("tx.outs: {:?}", tx.outs);
    let public_inputs: HashMap<String, String> = x.value().unwrap();
    println!("public_inputs: {:?}", public_inputs);

    match app.tag {
        NFT => {
            let action = public_inputs["action"].as_str();

            match action {
                "deploy" => {
                    check!(crate::nft_deploy_satisfied(app, tx))
                }
                "update" => {
                    check!(crate::nft_update_satisfied(app, tx))
                }
                _ => {
                    unreachable!("Unsupported action: {}", action);
                }
            }
        }
        _ => {
            unreachable!()
        }
    }

    true
}

charms_sdk::main!(app_contract);
