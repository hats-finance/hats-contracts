## Initial gas measurement running `npm run gas-avg`

- 6975095

## Gas savings

- ### HATVault.sol

  - ### SubmitClaim (initial average = `352515`, after optimizing = `352411`)

    - Use `++nonce` instead of `nonce++` (nonce is a state variable)
      - [line 212](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L212)
    - for calculations that wont overflow or underflow, use the `unchecked{}` block
      - [line 208-209](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L208-209)

  - #### challengeClaim (initial average = `63089`, after optimizing = )
    - for calculations that wont overflow or underflow, use the `unchecked{}` block
  - [line 244](https://github.com/hats-finance/hats-contracts/blob/15b37a68f97f8f737a8808a9ff55d60bc2376d7e/contracts/HATVault.sol#L244)

* ### HATTimeLockController
* ### HATTokenLOck
* ### HATVaultRegistry
* ### RewardController
* ### TokenLockFactory

* Write the functions I modified and the amount of gas i was able to save
