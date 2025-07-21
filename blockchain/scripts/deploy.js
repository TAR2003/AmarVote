const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying BallotContract...");

  // Get the contract factory
  const BallotContract = await ethers.getContractFactory("BallotContract");

  // Deploy the contract
  const ballotContract = await BallotContract.deploy();
  await ballotContract.waitForDeployment();

  const contractAddress = await ballotContract.getAddress();
  console.log("BallotContract deployed to:", contractAddress);

  // Save contract address and ABI for the microservice
  const contractInfo = {
    address: contractAddress,
    abi: JSON.parse(BallotContract.interface.formatJson())
  };

  // Ensure the blockchain-microservice directory exists
  const microserviceDir = path.join(__dirname, "../../blockchain-microservice");
  if (!fs.existsSync(microserviceDir)) {
    fs.mkdirSync(microserviceDir, { recursive: true });
  }

  // Write contract info to file that microservice can read
  fs.writeFileSync(
    path.join(microserviceDir, "BallotContract.json"),
    JSON.stringify(contractInfo, null, 2)
  );

  console.log("Contract info saved to blockchain-microservice/BallotContract.json");

  // Get signers for setting up test data
  const [deployer, voter1, voter2] = await ethers.getSigners();
  console.log("Deployer address:", await deployer.getAddress());
  console.log("Voter1 address:", await voter1.getAddress());
  console.log("Voter2 address:", await voter2.getAddress());

  // Set up a test election
  const electionId = "test_election_2024";
  const startTime = Math.floor(Date.now() / 1000); // Now
  const endTime = startTime + (7 * 24 * 60 * 60); // 7 days from now

  console.log("Creating test election...");
  await ballotContract.createElection(electionId, startTime, endTime);

  // Register test voters
  console.log("Registering test voters...");
  await ballotContract.registerVoter(electionId, await voter1.getAddress());
  await ballotContract.registerVoter(electionId, await voter2.getAddress());

  console.log("Setup complete!");

  // Write environment file for docker-compose
  const envContent = `CONTRACT_ADDRESS=${contractAddress}
DEPLOYER_PRIVATE_KEY=${deployer.privateKey}
VOTER1_PRIVATE_KEY=${voter1.privateKey}
VOTER2_PRIVATE_KEY=${voter2.privateKey}
HARDHAT_URL=http://hardhat:8545
TEST_ELECTION_ID=${electionId}
`;

  fs.writeFileSync(path.join(__dirname, "../../.env"), envContent);
  console.log("Environment file created with contract details");

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
