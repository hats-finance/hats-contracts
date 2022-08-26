
## Deposit process 

User deposits `amount` tokens of `tokenContract` in a `HATVault`
1. User calls `tokenContract.approve(HATVault.address, amount)`
1. User calls `HATVault.deposit(amount, receiver)`
  1. tokens are transfered to the `HATVault` contract
  1. user's `shares` are updated to reflect her portion of the vault
  1. user's `shares` are automatically "staked" in the rewardController
  1. user can claim reward calling `rewardController.claimReward`
  1. whenever user deposits or withdraws, her rewards are transfered
  
