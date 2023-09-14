const config = require("./hardhat.config.js");

const {subtask} = require("hardhat/config");
const {TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS} = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS)
  .setAction(async (_, __, runSuper) => {
    const paths = await runSuper();
    // exclude HATAtribritaor as it only compiles with viaIR = true (which does not work with coverage)
    return paths.filter(p => !p.endsWith("HATArbitrator.sol") && !p.endsWith("ConnectorMock.sol"));
  });

config.solidity.settings.viaIR = false;
module.exports = config;
