## Submitting a claim

See [arbitrator.md](./arbitrator.md)

## Deposit process 

User deposits `amount` tokens of `tokenContracxt` in `HATVaults`
1. User calls `tokenContract.approve(HATVaults.address, amount)`
1. User calls `HATVaults.deposit(poolId, amount)`
  1. tokens are transfered to the `HATVaults` contract
  1. user's `shares` are updated to reflect her portion of the pool
  1. user's `shares` are automatically "staked" in the rewardPool 
  1. user can claim reward calling `rewardPool.getRewards`
  1. whenever user deposits or withdraws, her rewards are transfered
  

## Withdrawal process

TBD
