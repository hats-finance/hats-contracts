
const {deployments} = require('hardhat');

describe("Deployment", function() {
  it("Deployment and verification should work", async function() {
    await deployments.fixture();
  });
});
