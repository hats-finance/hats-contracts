# Payout of Bounties

Once approved, bounties are payed out divided into 5 parts:

## native token:

- `hacker` - The percentage of tokens that are sent directly to the hacker
- `hackerVested` - The percentage of reward sent to the hacker via vesting contract
- `committee` - The percentage sent to the committee
 
### HAT token:

- `hackerHatVested` - The percentage of the total bounty to be swapped to HATs and sent to the hacker via vesting contract
- `governanceHat` - The percentage of the total bounty to be swapped to HATs and sent to governance
 
 
The part that is swapped to HAT tokens (`hackerHatVested`, `governanceHat`) is only settable by the registry owner and cannot exceed 20% of the total bounty.

The part that is paid out in the vault's native token (`hacker`, `hackerVested`, `committee`) is only settable by the vault owner and accounts for the rest of the bounty (after the swapped part is deducted).

The part that goes to the committee cannot exceed 20% of the native token part of the bounty.