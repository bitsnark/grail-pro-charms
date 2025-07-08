use charms_sdk::data::{app_datas, check, App, Data, Transaction, UtxoId, NFT, TOKEN};

use crate::objects::{NftData, TransactionType, XBTCData};


pub fn token_mint_satisfied(
  token_app: &App,
  tx: &Transaction
) -> bool {

  tx.ins.iter().for_each(|input| {
    println!("Input: {:?}", input);
  });

  true
}

pub fn token_burn_satisfied(
  token_app: &App,
  tx: &Transaction
) -> bool {

  // Check that the input has the correct amout
  // And no outputs
  check!(tx.outs.len() == 0);
  check!(tx.ins.len() == 1);

  tx.ins.iter().for_each(|input| {
    println!("Input: {:?}", input);
  });

  true
}
