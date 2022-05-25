const ethSigUtil = require("eth-sig-util");

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

async function domainSeparator(name, chainId, verifyingContract) {
  return (
    "0x" +
    ethSigUtil.TypedDataUtils.hashStruct(
      "EIP712Domain",
      { name, chainId, verifyingContract },
      { EIP712Domain }
    ).toString("hex")
  );
}

module.exports = {
  EIP712Domain,
  domainSeparator,
};
