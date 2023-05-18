const HATHackersNFT = artifacts.require("./HATHackersNFT.sol");
const { assertVMException } = require("./common.js");

contract("HATHackersNFT", (accounts) => {
  it("should add vault NFTs", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.createNFTs("uri", 3);
    let tokenId1 = await hackersNft.getTokenId("uri", 0);
    let tokenId2 = await hackersNft.getTokenId("uri", 1);
    let tokenId3 = await hackersNft.getTokenId("uri", 2);
    assert.equal(await hackersNft.uri(tokenId1), "uri0");
    assert.equal(await hackersNft.uri(tokenId2), "uri1");
    assert.equal(await hackersNft.uri(tokenId3), "uri2");

    try {
      await hackersNft.createNFTs("uri", 3, { from: accounts[1] });
      throw "Only owner can add vault";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }
  });

  it("should mint an NFT", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.createNFTs("uri", 3);
    let tokenId1 = await hackersNft.getTokenId("uri", 0);

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
    await hackersNft.createNFTs("uri", 3);
    let tokenId1 = await hackersNft.getTokenId("uri", 0);
    let tokenId2 = await hackersNft.getTokenId("uri", 1);

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

  it("should stop minting of an NFT", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.createNFTs("uri", 3);
    let tokenId1 = await hackersNft.getTokenId("uri", 0);

    await hackersNft.mint(accounts[1], tokenId1, 1);
    assert.equal(await hackersNft.balanceOf(accounts[1], tokenId1), 1);
    assert.equal(await hackersNft.totalSupply(tokenId1), 1);

    try {
      await hackersNft.stopMint(tokenId1, { from: accounts[1] });
      throw "Only owner can stop minting";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }

    let tx = await hackersNft.stopMint(tokenId1);
    assert.equal(tx.logs[0].event, "MintingStopped");
    assert.equal(tx.logs[0].args._tokenId, tokenId1.toString());

    try {
      await hackersNft.mint(accounts[1], tokenId1, 1);
      throw "Cannot mint token after minting stopped";
    } catch (error) {
      assertVMException(error, "MintingOfTokenStopped");
    }

    try {
      await hackersNft.stopMint(tokenId1);
      throw "Cannot stop minting of a token after minting already stopped";
    } catch (error) {
      assertVMException(error, "MintingAlreadyStopped");
    }
  });

  it("should stop minting of multiple NFTs", async () => {
    const hackersNft = await HATHackersNFT.new();
    await hackersNft.createNFTs("uri", 3);
    let tokenId1 = await hackersNft.getTokenId("uri", 0);
    let tokenId2 = await hackersNft.getTokenId("uri", 1);

    try {
      await hackersNft.stopMintMultiple([tokenId1, tokenId2], { from: accounts[1] });
      throw "Only owner can stop minting";
    } catch (error) {
      assertVMException(error, "Ownable: caller is not the owner");
    }

    let tx = await hackersNft.stopMintMultiple([tokenId1, tokenId2]);
    assert.equal(tx.logs[0].event, "MintingStopped");
    assert.equal(tx.logs[0].args._tokenId, tokenId1.toString());
    assert.equal(tx.logs[1].event, "MintingStopped");
    assert.equal(tx.logs[1].args._tokenId, tokenId2.toString());

    try {
      await hackersNft.mint(accounts[1], tokenId1, 1);
      throw "Cannot mint token after minting stopped";
    } catch (error) {
      assertVMException(error, "MintingOfTokenStopped");
    }

    try {
      await hackersNft.mint(accounts[1], tokenId2, 1);
      throw "Cannot mint token after minting stopped";
    } catch (error) {
      assertVMException(error, "MintingOfTokenStopped");
    }

    try {
      await hackersNft.stopMintMultiple([tokenId1, tokenId2]);
      throw "Cannot stop minting of a token after minting already stopped";
    } catch (error) {
      assertVMException(error, "MintingAlreadyStopped");
    }
  });
});
