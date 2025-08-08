#![no_main]

use std::collections::HashMap;

use charms_sdk::data::{check, App, Data, Transaction, NFT, TOKEN};

use crate::nft::{nft_deploy_satisfied, nft_update_satisfied};
use crate::token::{token_nft_satisfied, token_transfer_satisfied};

pub mod common;
pub mod nft;
pub mod objects;
pub mod token;

pub fn app_contract(app: &App, tx: &Transaction, pub_in: &Data, priv_in: &Data) -> bool {
    let public_inputs: HashMap<String, String> = pub_in.value().unwrap();

    let action = public_inputs["action"].as_str();

    match app.tag {
        NFT => match action {
            "deploy" => {
                check!(crate::nft_deploy_satisfied(app, tx, pub_in, priv_in))
            }
            "update" => {
                check!(crate::nft_update_satisfied(app, tx))
            }
            _ => {
                unreachable!("Unsupported action: {}", action);
            }
        },
        TOKEN => match action {
            "mint" => {
                check!(crate::token_nft_satisfied(app, tx));
            }
            "burn" => {
                check!(crate::token_nft_satisfied(app, tx));
            }
            "transfer" => {
                check!(crate::token_transfer_satisfied(app, tx));
            }
            _ => {
                unreachable!("Unsupported action: {}", action);
            }
        },
        _ => {
            unreachable!()
        }
    }

    true
}

charms_sdk::main!(app_contract);
