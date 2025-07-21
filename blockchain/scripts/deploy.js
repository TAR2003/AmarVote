async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const BallotTracker = await ethers.getContractFactory("BallotTracker");
  const ballotTracker = await BallotTracker.deploy();

  // Wait for deployment to complete (no more .deployed() in ethers v6)
  await ballotTracker.waitForDeployment();

  console.log("BallotTracker deployed to:", await ballotTracker.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
