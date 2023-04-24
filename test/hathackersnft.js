const HATHackersNFT = artifacts.require("./HATHackersNFT.sol");
const { assertVMException } = require("./common.js");

contract("HATHackersNFT", (accounts) => {
  it("should add vault NFTs", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.addVault(accounts[0], "cool vault", 3, "uri");
    let tokenId1 = await hackersNft.getTokenId(accounts[0], "cool vault", 0);
    let tokenId2 = await hackersNft.getTokenId(accounts[0], "cool vault", 1);
    let tokenId3 = await hackersNft.getTokenId(accounts[0], "cool vault", 2);
    assert.equal(await hackersNft.uri(tokenId1), "uri0");
    assert.equal(await hackersNft.uri(tokenId2), "uri1");
    assert.equal(await hackersNft.uri(tokenId3), "uri2");

    try {
      await hackersNft.addVault(accounts[0], "cool vault", 3, "uri", { from: accounts[1] });
      throw "Only owner can add vault";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }
  });

  it("should mint an NFT", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.addVault(accounts[0], "cool vault", 3, "uri");
    let tokenId1 = await hackersNft.getTokenId(accounts[0], "cool vault", 0);

    await hackersNft.mint(accounts[1], tokenId1, 1);
    assert.equal(await hackersNft.balanceOf(accounts[1], tokenId1), 1);
    assert.equal(await hackersNft.totalSupply(tokenId1), 1);

    try {
      await hackersNft.mint(accounts[1], tokenId1, 1, { from: accounts[1] });
      throw "Only owner can mint";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }

    try {
      await hackersNft.mint(accounts[1], 0, 1);
      throw "Cannot mint non existing token";
    } catch (error) {
      assertVMException(error, "TokenDoesNotExist");
    }
  });

  it("should mint multiple NFTs", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.addVault(accounts[0], "cool vault", 3, "uri");
    let tokenId1 = await hackersNft.getTokenId(accounts[0], "cool vault", 0);
    let tokenId2 = await hackersNft.getTokenId(accounts[0], "cool vault", 1);

    await hackersNft.mintMultiple([accounts[1], accounts[1], accounts[2]], [tokenId1, tokenId2, tokenId2], [1, 2, 1]);
    assert.equal(await hackersNft.balanceOf(accounts[1], tokenId1), 1);
    assert.equal(await hackersNft.totalSupply(tokenId1), 1);

    assert.equal(await hackersNft.balanceOf(accounts[1], tokenId2), 2);
    assert.equal(await hackersNft.balanceOf(accounts[2], tokenId2), 1);
    assert.equal(await hackersNft.totalSupply(tokenId2), 3);

    try {
      await hackersNft.mintMultiple([accounts[1], accounts[1], accounts[2]], [tokenId1, tokenId2, tokenId2], [1, 2, 1], { from: accounts[1] });
      throw "Only owner can mint";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }

    try {
      await hackersNft.mintMultiple([accounts[1], accounts[2]], [tokenId1, tokenId2, tokenId2], [1, 2, 1]);
      throw "Array lengths must match";
    } catch (error) {
      assertVMException(error, "MintArrayLengthMismatch");
    }

    try {
      await hackersNft.mintMultiple([accounts[1], accounts[2]], [tokenId1, tokenId2], [1, 2, 1]);
      throw "Array lengths must match";
    } catch (error) {
      assertVMException(error, "MintArrayLengthMismatch");
    }

    try {
      await hackersNft.mintMultiple([accounts[1], accounts[2]], [tokenId1, tokenId2, tokenId2], [1, 1]);
      throw "Array lengths must match";
    } catch (error) {
      assertVMException(error, "MintArrayLengthMismatch");
    }

    try {
      await hackersNft.mintMultiple([accounts[1], accounts[2]], [0, tokenId2], [1, 1]);
      throw "Cannot mint non existing token";
    } catch (error) {
      assertVMException(error, "TokenDoesNotExist");
    }
  });
});
