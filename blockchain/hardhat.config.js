require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      chainId: 1337, // Standard localhost chain ID
    },
    localhost: {
      url: "http://0.0.0.0:8545",
    },
  },
};
