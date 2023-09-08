# Reward program

The HATVaults contracts come with a mechanism to reward users for putting their funds at risk in a vault. This mechanism is implemented in the RewardController.

Rewards accumulate automatically, and each depositor in the vault will get a share of the rewards proportional to her share of the total vault deposits and the time that here funds were committed to the vault.


Anyone can claim the rewards for a user by calling `rewardController.claimReward(_vault, _user)`