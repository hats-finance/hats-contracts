const { ethers } = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { expect } = require('chai');
const tokensHATVaults1 = require('./tokensHATVaults1.json');
const tokensHATVaults2 = require('./tokensHATVaults2.json');
const tokens2HATVaults1 = require('./tokens2HATVaults1.json');
const tokens2HATVaults2 = require('./tokens2HATVaults2.json');
const DAY = 60 * 60 * 24;

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

function hashToken(hatVaults, pid, account, tier) {
  return Buffer.from(
    ethers.utils.solidityKeccak256(
      ['address', 'uint256', 'address', 'uint8'],
      [hatVaults, pid, account, tier]
    ).slice(2),
    'hex'
  );
}

async function now() {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
}

async function verifyMultipleRedeems(
  tx,
  redeemer,
  tokenIds,
  hatVaults,
  pools,
  account,
  tiers,
  tiersRedeemed = tiers
) {
  let receipt = await tx.wait();
  await expect(receipt.events.length.toString()).to.be.equal(tiersRedeemed.reduce((partialSum, a) => partialSum + a, 0).toString());
  let j = hatVaults.length - 1;
  let k = 0;
  for (const i in receipt.events.reverse()) {
    if (tiersRedeemed[j] <= i) {
      k = i;
      j--;
      if (j < 0) {
        break;
      }
    }
    const event = receipt.events[i];
    await expect(event.args.operator).to.be.equal(redeemer);
    await expect(event.args.from).to.be.equal(ethers.constants.AddressZero);
    await expect(event.args.to.toLowerCase()).to.be.equal(account.toLowerCase());
    await expect(event.args.id).to.be.equal(tokenIds[hatVaults[j]][pools[j]][tiers[j] - 1 - (i - k)].toString());
    await expect(event.args.value).to.be.equal(1);
  }
}

async function verifyRedeem(
  tx,
  redeemer,
  tokenIds,
  hatVaults,
  pool,
  account,
  tier,
  tiersRedeemed = tier
) {
  let receipt = await tx.wait();
  await expect(receipt.events.length.toString()).to.be.equal(tiersRedeemed.toString());
  for (const i in receipt.events.reverse()) {
    if (tiersRedeemed <= i) {
      break;
    }
    const event = receipt.events[i];
    await expect(event.args.operator).to.be.equal(redeemer);
    await expect(event.args.from).to.be.equal(ethers.constants.AddressZero);
    await expect(event.args.to.toLowerCase()).to.be.equal(account.toLowerCase());
    await expect(event.args.id).to.be.equal(tokenIds[hatVaults][pool][tier - 1 - i].toString());
    await expect(event.args.value).to.be.equal(1);
  }
}

describe('HATVaultsNFT', function () {
  before(async function() {
    this.accounts = await ethers.getSigners();
    this.hatVaultsV1 = await deploy("HATVaultsV1Mock");
    this.hatVaultsV2 = await deploy("HATVaultsV2Mock");
    this.hatVaultsV1Data = await deploy("HATVaultsV1Data", this.hatVaultsV1.address);
    this.hatVaultsV2Data = await deploy("HATVaultsV2Data", this.hatVaultsV2.address);
    this.tokens = {};
    this.tokens[this.hatVaultsV1Data.address] = tokensHATVaults1;
    this.tokens[this.hatVaultsV2Data.address] = tokensHATVaults2;
    this.hatVaultsContracts = [this.hatVaultsV1Data.address, this.hatVaultsV2Data.address];
    this.hashes = [];
    for(const hatVaults of this.hatVaultsContracts) {
      for (const pool of Object.keys(this.tokens[hatVaults])) {
        for (const [account, tier] of Object.entries(this.tokens[hatVaults][pool])) {
          this.hashes.push(hashToken(hatVaults, pool, account, tier));
        }
      }
    }

    this.merkleTree = new MerkleTree(this.hashes, keccak256, { sortPairs: true });
  });

  describe('Mint all tokens', function () {
    before(async function() {
      this.registry = await deploy(
        'HATVaultsNFT',
        "QmSUXfYsk9HgrMBa7tgp3MBm8FGwDF9hnVaR9C1PMoFdS3",
        this.merkleTree.getHexRoot(),
        (await now()) + DAY,
      );
      this.tokenIds = {};
      for(const hatVaults of this.hatVaultsContracts) {
        this.tokenIds[hatVaults] = {};
        for (const pool of Object.keys(this.tokens[hatVaults])) {
          this.registry.addVault(hatVaults, pool, "https://gateway.pinata.cloud/ipfs/id/");
          this.tokenIds[hatVaults][pool] = [
            await this.registry.getTokenId(hatVaults, pool, 1),
            await this.registry.getTokenId(hatVaults, pool, 2),
            await this.registry.getTokenId(hatVaults, pool, 3)
          ];
        }
      }
    });

    it('Mint all tree elements', async function () {
      let mintedTokens = 0;
      await expect(await this.registry.totalSupply()).to.be.equal(mintedTokens);
      for(const hatVaults of this.hatVaultsContracts) {
        for (const pool of Object.keys(this.tokens[hatVaults])) {
          for (const [account, tier] of Object.entries(this.tokens[hatVaults][pool])) {
            /**
             * Create merkle proof (anyone with knowledge of the merkle tree)
             */
            const proof = this.merkleTree.getHexProof(hashToken(hatVaults, pool, account, tier));
            /**
             * Redeems token using merkle proof (anyone with the proof)
             */
            await verifyRedeem(
              await this.registry.redeemSingleFromTree(hatVaults, pool, account, tier, proof),
              this.accounts[0].address,
              this.tokenIds,
              hatVaults,
              pool,
              account,
              tier
            );
            mintedTokens += parseInt(tier);
          }
        }
      }
      await expect(await this.registry.totalSupply()).to.be.equal(mintedTokens);
    });

    it('Mint active depositors tokens', async function () {
      this.hatVaultsV1.addShares(0, this.accounts[0].address, 10000);
      this.hatVaultsV2.addShares(0, this.accounts[0].address, 10000);
      
      await expect(await this.registry.isEligible(this.hatVaultsV1Data.address, 0, this.accounts[0].address)).to.be.equal(true);
      await expect(await this.registry.getTierFromShares(this.hatVaultsV1Data.address, 0, this.accounts[0].address)).to.be.equal(3);
      let tiersRedeemable = await this.registry.getTiersToRedeemFromShares(this.hatVaultsV1Data.address, 0, this.accounts[0].address);
      await expect(tiersRedeemable[0]).to.be.equal(true);
      await expect(tiersRedeemable[1]).to.be.equal(true);
      await expect(tiersRedeemable[2]).to.be.equal(true);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV1Data.address, 0, this.accounts[0].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV1Data.address,
        0,
        this.accounts[0].address,
        3
      );

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, this.accounts[0].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        this.accounts[0].address,
        3
      );

      await this.hatVaultsV2.addShares(0, this.accounts[1].address, 1000);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, this.accounts[1].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        this.accounts[1].address,
        2
      );

      await this.hatVaultsV2.addShares(0, this.accounts[2].address, 100);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, this.accounts[2].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        this.accounts[2].address,
        1
      );
    });

    it('Mint from multiple vaults for depositor', async function () {
      this.hatVaultsV1.addShares(4, this.accounts[0].address, 10000);
      this.hatVaultsV2.addShares(5, this.accounts[0].address, 100);
      this.hatVaultsV2.addShares(5, this.accounts[1].address, 10000);

      await expect(this.registry.redeemMultipleFromShares(
        [this.hatVaultsV1Data.address],
        [4, 5],
        this.accounts[0].address
      )).to.be.revertedWith('Arrays lengths must match');
      
      await verifyMultipleRedeems(
        await this.registry.redeemMultipleFromShares(
          [this.hatVaultsV1Data.address, this.hatVaultsV2Data.address],
          [4, 5],
          this.accounts[0].address
        ),
        this.accounts[0].address,
        this.tokenIds,
        [this.hatVaultsV1Data.address, this.hatVaultsV2Data.address],
        [4, 5],
        this.accounts[0].address,
        [3, 1]
      );
    });

    it('Only owner can add vault', async function () {
      await expect(this.registry.connect(this.accounts[1]).addVault(this.hatVaultsV1Data.address, 15, "https://gateway.pinata.cloud/ipfs/id/"))
          .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Cannot add an existing vault', async function () {
      await expect(this.registry.addVault(this.hatVaultsV1Data.address, 4, "https://gateway.pinata.cloud/ipfs/id/"))
          .to.be.revertedWith('Vault already exists');
    });

    it('Accounts with less than 0.1% should not be eligible to redeem', async function () {
      await this.hatVaultsV2.addShares(0, this.accounts[3].address, 10);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, this.accounts[3].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        this.accounts[3].address,
        0
      );

      await this.hatVaultsV2.addShares(0, this.accounts[3].address, 20);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, this.accounts[3].address),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        this.accounts[3].address,
        1
      );
    });

    it('Cannot redeem from tree and as depositor', async function () {
      const depositor = "0x866fdcfb71de6b584eb8310a3b04fae7ecafb1fd";
      await this.hatVaultsV2.addShares(0, depositor, 1000);

      await expect(await this.registry.isEligible(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(false);
      await expect(await this.registry.getTierFromShares(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(2);
      let tiersRedeemable = await this.registry.getTiersToRedeemFromShares(this.hatVaultsV2Data.address, 0, depositor);
      await expect(tiersRedeemable[0]).to.be.equal(false);
      await expect(tiersRedeemable[1]).to.be.equal(false);
      await expect(tiersRedeemable[2]).to.be.equal(false);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, depositor),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        depositor,
        0
      );

      await this.hatVaultsV2.addShares(0, depositor, 10000);

      await expect(await this.registry.isEligible(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(true);
      await expect(await this.registry.getTierFromShares(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(3);
      tiersRedeemable = await this.registry.getTiersToRedeemFromShares(this.hatVaultsV2Data.address, 0, depositor);
      await expect(tiersRedeemable[0]).to.be.equal(false);
      await expect(tiersRedeemable[1]).to.be.equal(false);
      await expect(tiersRedeemable[2]).to.be.equal(true);

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 0, depositor),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        depositor,
        3,
        1
      );

      await expect(await this.registry.isEligible(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(false);
      await expect(await this.registry.getTierFromShares(this.hatVaultsV2Data.address, 0, depositor)).to.be.equal(3);
      tiersRedeemable = await this.registry.getTiersToRedeemFromShares(this.hatVaultsV2Data.address, 0, depositor);
      await expect(tiersRedeemable[0]).to.be.equal(false);
      await expect(tiersRedeemable[1]).to.be.equal(false);
      await expect(tiersRedeemable[2]).to.be.equal(false);
    });

    it('Cannot redeem from tree twice', async function () {
      const depositor = "0x866fdcfb71de6b584eb8310a3b04fae7ecafb1fd";
      const proof = this.merkleTree.getHexProof(hashToken(this.hatVaultsV2Data.address, 0, depositor, 2));
      await verifyRedeem(
        await this.registry.redeemSingleFromTree(this.hatVaultsV2Data.address, 0, depositor, 2, proof),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        0,
        depositor,
        0
      );
    });

    it('Cannot redeem with bad proof', async function () {
      const proof = this.merkleTree.getHexProof(hashToken(this.hatVaultsV2Data.address, 0, this.accounts[0].address, 3));
      await expect(this.registry.redeemSingleFromTree(this.hatVaultsV2Data.address, 0, this.accounts[0].address, 3, proof))
        .to.be.revertedWith('Invalid merkle proof');
    });

    const newMerkleTreeIPFSRef = "QmSUXfYsk9HgrMBa7tgp3MBm8FGwDF9hnVaR9C1PNEWREF";
    let newRoot;
    it('Cannot update tree before deadline', async function () {
      const newDeadline = (await now()) + (DAY * 2);
      this.tokens2 = {};
      this.tokens2[this.hatVaultsV1Data.address] = tokens2HATVaults1;
      this.tokens2[this.hatVaultsV2Data.address] = tokens2HATVaults2;
      this.hashes = [];
      for(const hatVaults of this.hatVaultsContracts) {
        for (const pool of Object.keys(this.tokens2[hatVaults])) {
          for (const [account, tier] of Object.entries(this.tokens2[hatVaults][pool])) {
            this.hashes.push(hashToken(hatVaults, pool, account, tier));
          }
        }
      }

      this.merkleTree = new MerkleTree(this.hashes, keccak256, { sortPairs: true });
      newRoot = this.merkleTree.getHexRoot();
      await expect(this.registry.updateTree(newMerkleTreeIPFSRef, newRoot, newDeadline))
          .to.be.revertedWith('Minting deadline was not reached');
    });

    it('Cannot update tree with deadline in the past', async function () {
      const newDeadline = (await now()) - 1;
      await network.provider.send("evm_increaseTime", [DAY + 1]);
      await network.provider.send("evm_mine");
      await expect(this.registry.updateTree(newMerkleTreeIPFSRef, newRoot, newDeadline))
          .to.be.revertedWith('New deadline already passed');
    });

    it('Only owner can update tree', async function () {
      const newDeadline = (await now()) + (DAY * 2);
      await expect(this.registry.connect(this.accounts[1]).updateTree(newMerkleTreeIPFSRef, newRoot, newDeadline))
          .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Update tree', async function () {
      const newDeadline = (await now()) + (DAY * 2);
      await expect(this.registry.updateTree(newMerkleTreeIPFSRef, newRoot, newDeadline))
          .to.emit(this.registry, 'MerkleTreeChanged')
          .withArgs(newMerkleTreeIPFSRef, newRoot, newDeadline);

      // Only add vaults of the v1 hat vaults
      this.tokenIds[this.hatVaultsV1Data.address] = {};
      for (const pool of Object.keys(this.tokens2[this.hatVaultsV1Data.address])) {
        this.registry.addVault(this.hatVaultsV1Data.address, pool, "https://gateway.pinata.cloud/ipfs/id/");
        this.tokenIds[this.hatVaultsV1Data.address][pool] = [
          await this.registry.getTokenId(this.hatVaultsV1Data.address, pool, 1),
          await this.registry.getTokenId(this.hatVaultsV1Data.address, pool, 2),
          await this.registry.getTokenId(this.hatVaultsV1Data.address, pool, 3)
        ];
      }
    });

    it('Redeem multiple tokens from tree', async function () {
      const depositor = "0xecf46106e79bd9b67cd23a3b01eac6b7287aeb97";
      const proofs = [
        this.merkleTree.getHexProof(hashToken(this.hatVaultsV1Data.address, 9, depositor, 3)), 
        this.merkleTree.getHexProof(hashToken(this.hatVaultsV1Data.address, 10, depositor, 1)),
      ];

      await expect(this.registry.redeemMultipleFromTree(
        [
          this.hatVaultsV1Data.address,
        ],
        [9, 10],
        depositor,
        [3, 1],
        proofs
      )).to.be.revertedWith('Arrays lengths must match');

      await expect(this.registry.redeemMultipleFromTree(
        [
          this.hatVaultsV1Data.address,
          this.hatVaultsV1Data.address,
        ],
        [9],
        depositor,
        [3, 1],
        proofs
      )).to.be.revertedWith('Arrays lengths must match');


      await expect(this.registry.redeemMultipleFromTree(
        [
          this.hatVaultsV1Data.address,
          this.hatVaultsV1Data.address,
        ],
        [9, 10],
        depositor,
        [3],
        proofs
      )).to.be.revertedWith('Arrays lengths must match');

      await expect(this.registry.redeemMultipleFromTree(
        [
          this.hatVaultsV1Data.address,
          this.hatVaultsV1Data.address,
        ],
        [9, 10],
        depositor,
        [3, 1],
        [proofs[0]]
      )).to.be.revertedWith('Arrays lengths must match');

      await verifyMultipleRedeems(
        await this.registry.redeemMultipleFromTree(
          [
            this.hatVaultsV1Data.address,
            this.hatVaultsV1Data.address,
          ],
          [9, 10],
          depositor,
          [3, 1],
          proofs
        ),
        this.accounts[0].address,
        this.tokenIds,
        [
          this.hatVaultsV1Data.address,
          this.hatVaultsV1Data.address,
        ],
        [9, 10],
        depositor,
        [3, 1],
      );
    });

    it('Cannot redeem non existing token', async function () {
      const depositor = "0x48112b9aa36baf6ac6b9bf847131c7e8ee55b871";
      const proof = this.merkleTree.getHexProof(hashToken(this.hatVaultsV2Data.address, 6, depositor, 3));
      await expect(this.registry.redeemSingleFromTree(this.hatVaultsV2Data.address, 6, depositor, 3, proof))
        .to.be.revertedWith('Token does not exist');

      this.tokenIds[this.hatVaultsV2Data.address] = {};
      for (const pool of Object.keys(this.tokens2[this.hatVaultsV2Data.address])) {
        this.registry.addVault(this.hatVaultsV2Data.address, pool, "https://gateway.pinata.cloud/ipfs/id/");
        this.tokenIds[this.hatVaultsV2Data.address][pool] = [
          await this.registry.getTokenId(this.hatVaultsV2Data.address, pool, 1),
          await this.registry.getTokenId(this.hatVaultsV2Data.address, pool, 2),
          await this.registry.getTokenId(this.hatVaultsV2Data.address, pool, 3)
        ];
      }

      await verifyRedeem(
        await this.registry.redeemSingleFromTree(this.hatVaultsV2Data.address, 6, depositor, 3, proof),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV2Data.address,
        6,
        depositor,
        3
      );
    });

    it('Cannot redeem from shares from empty pool', async function () {
      await this.hatVaultsV2.addShares(6, this.accounts[0].address, 0);
      await expect(this.registry.redeemSingleFromShares(this.hatVaultsV2Data.address, 6, this.accounts[0].address))
        .to.be.revertedWith('Pool is empty');
    });

    it('Cannot get tiers from non existing pool', async function () {
      await this.hatVaultsV2.addShares(20, this.accounts[0].address, 1000);
      await expect(this.registry.getTiersToRedeemFromShares(this.hatVaultsV2Data.address, 20, this.accounts[0].address))
        .to.be.revertedWith('Token does not exist');
    });

    it('Pause and resume vault', async function () {
      await expect(this.registry.connect(this.accounts[1]).pauseVault(this.hatVaultsV1Data.address, 8))
          .to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.registry.pauseVault(this.hatVaultsV1Data.address, 8))
        .to.emit(this.registry, 'VaultPaused')
        .withArgs(this.hatVaultsV1Data.address, 8);
      const depositorPausedVault = "0x9214574DC772B6FD34da960054d0baF29b0c9f9e";
      const depositorActiveVault = "0xbAAEa72417f4dC3E0f52a1783B0913d0f3516634";
      const proofPauesedVault = this.merkleTree.getHexProof(hashToken(this.hatVaultsV1Data.address, 8, depositorPausedVault, 2));
      const proofActiveVault = this.merkleTree.getHexProof(hashToken(this.hatVaultsV1Data.address, 9, depositorActiveVault, 2));
      await expect(this.registry.redeemSingleFromTree(this.hatVaultsV1Data.address, 8, depositorPausedVault, 2, proofPauesedVault))
        .to.be.revertedWith('Vault paused');

      await this.hatVaultsV1.addShares(8, depositorPausedVault, 10000);
      await expect(this.registry.redeemSingleFromShares(this.hatVaultsV1Data.address, 8, depositorPausedVault))
        .to.be.revertedWith('Vault paused');

      await this.hatVaultsV1.addShares(9, depositorPausedVault, 10000);
      await verifyRedeem(
        await this.registry.redeemSingleFromTree(this.hatVaultsV1Data.address, 9, depositorActiveVault, 2, proofActiveVault),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV1Data.address,
        9,
        depositorActiveVault,
        2
      );

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV1Data.address, 9, depositorPausedVault),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV1Data.address,
        9,
        depositorPausedVault,
        3
      );

      await expect(this.registry.connect(this.accounts[1]).resumeVault(this.hatVaultsV1Data.address, 8))
          .to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.registry.resumeVault(this.hatVaultsV1Data.address, 8))
        .to.emit(this.registry, 'VaultResumed')
        .withArgs(this.hatVaultsV1Data.address, 8);

      await verifyRedeem(
        await this.registry.redeemSingleFromTree(this.hatVaultsV1Data.address, 8, depositorPausedVault, 2, proofPauesedVault),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV1Data.address,
        8,
        depositorPausedVault,
        2
      );

      await verifyRedeem(
        await this.registry.redeemSingleFromShares(this.hatVaultsV1Data.address, 8, depositorPausedVault),
        this.accounts[0].address,
        this.tokenIds,
        this.hatVaultsV1Data.address,
        8,
        depositorPausedVault,
        3,
        1
      );
    });

    it('Cannot redeem after the deadline', async function () {
      await network.provider.send("evm_increaseTime", [DAY * 2 + 1]);
      await network.provider.send("evm_mine");

      const depositor = "0x1ebef03483030dd746c0bba924e828ce2c0534ea";
      const proof = this.merkleTree.getHexProof(hashToken(this.hatVaultsV2Data.address, 10, depositor, 1));
      await expect(this.registry.redeemSingleFromTree(this.hatVaultsV2Data.address, 10, depositor, 1, proof))
        .to.be.revertedWith('Minting deadline passed');
    });

    it('Check token URIs', async function () {
      await expect(await this.registry.uri(1)).to.be.equal("");      
      await expect(await this.registry.uri(await this.registry.getTokenId(this.hatVaultsV1Data.address, 0, 1))).to.be.equal("https://gateway.pinata.cloud/ipfs/id/1");      
      await expect(await this.registry.uri(await this.registry.getTokenId(this.hatVaultsV1Data.address, 0, 2))).to.be.equal("https://gateway.pinata.cloud/ipfs/id/2");      
      await expect(await this.registry.uri(await this.registry.getTokenId(this.hatVaultsV1Data.address, 0, 3))).to.be.equal("https://gateway.pinata.cloud/ipfs/id/3");      
      await expect(await this.registry.uri(await this.registry.getTokenId(this.hatVaultsV1Data.address, 1, 1))).to.be.equal("https://gateway.pinata.cloud/ipfs/id/1");      
    });

    it('Cannot initialize with deadline in the past', async function () {
      await expect(deploy(
        'HATVaultsNFT',
        "QmSUXfYsk9HgrMBa7tgp3MBm8FGwDF9hnVaR9C1PMoFdS3",
        this.merkleTree.getHexRoot(),
        (await now()) - 1,
      )).to.be.revertedWith('Deadline already passed');
    });
  });
});
