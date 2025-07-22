module.exports = {
  networks: {
    development: {
      host: process.env.GANACHE_HOST || "ganache",
      port: process.env.GANACHE_PORT || 8545,
      network_id: process.env.NETWORK_ID || 1337,
      gas: 6721975,
      gasPrice: 20000000000,
      from: undefined, // Will be set automatically to the first account
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "byzantium"
      }
    }
  }
};
