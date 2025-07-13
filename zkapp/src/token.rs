use charms_sdk::data::{check, App, Transaction};

pub fn token_mint_satisfied(
  _token_app: &App,
  tx: &Transaction
) -> bool {

  tx.ins.iter().for_each(|input| {
    println!("Input: {:?}", input);
  });

  true
}

pub fn token_burn_satisfied(
  _token_app: &App,
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
