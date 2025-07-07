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
