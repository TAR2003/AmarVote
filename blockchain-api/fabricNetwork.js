const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Connection profile
const ccpPath = path.resolve(__dirname, 'connection-profile.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// Wallet path
const walletPath = path.join(process.cwd(), 'wallet');

async function getContract() {
    try {
        // Load wallet
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Check if admin identity exists
        const identity = await wallet.get('admin');
        if (!identity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            throw new Error('Admin identity not found in wallet');
        }

        // Create gateway
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: false }
        });

        // Get network and contract
        const network = await gateway.getNetwork('electionchannel');
        const contract = network.getContract('election-logs');
        
        return { gateway, contract };
    } catch (error) {
        console.error(`Failed to get contract: ${error}`);
        throw error;
    }
}

async function initLedger() {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction('initLedger');
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logElectionCreated(electionId, electionName, organizerName, startDate, endDate) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logElectionCreated',
            electionId,
            electionName,
            organizerName,
            startDate,
            endDate
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logBallotReceived(electionId, trackingCode, ballotHash, voterId) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logBallotReceived',
            electionId,
            trackingCode,
            ballotHash,
            voterId
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logElectionEnded(electionId, totalVotes, endedBy) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logElectionEnded',
            electionId,
            totalVotes,
            endedBy
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logElectionStarted(electionId, startedBy) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logElectionStarted',
            electionId,
            startedBy
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logBallotAudited(electionId, trackingCode, ballotHash) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logBallotAudited',
            electionId,
            trackingCode,
            ballotHash
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logEncryptedBallotCreated(electionId, trackingCode, ballotHash, voterEmail) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logEncryptedBallotCreated',
            electionId,
            trackingCode,
            ballotHash,
            voterEmail
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logBenalohChallenge(electionId, trackingCode, ballotHash, voterEmail, challengeSucceeded) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logBenalohChallenge',
            electionId,
            trackingCode,
            ballotHash,
            voterEmail,
            challengeSucceeded
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logGuardianKeySubmitted(electionId, guardianEmail, guardianId, publicKeyHash) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logGuardianKeySubmitted',
            electionId,
            guardianEmail,
            guardianId,
            publicKeyHash
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function logBallotCast(electionId, trackingCode, ballotHash, voterEmail) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.submitTransaction(
            'logBallotCast',
            electionId,
            trackingCode,
            ballotHash,
            voterEmail
        );
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function getElectionLogs(electionId) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.evaluateTransaction('getElectionLogs', electionId);
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function queryLogsByType(electionId, logType) {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.evaluateTransaction('queryLogsByType', electionId, logType);
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

async function getAllLogs() {
    const { gateway, contract } = await getContract();
    try {
        const result = await contract.evaluateTransaction('getAllLogs');
        return JSON.parse(result.toString());
    } finally {
        gateway.disconnect();
    }
}

module.exports = {
    initLedger,
    logElectionCreated,
    logBallotReceived,
    logElectionEnded,
    logElectionStarted,
    logBallotAudited,
    logEncryptedBallotCreated,
    logBenalohChallenge,
    logGuardianKeySubmitted,
    logBallotCast,
    getElectionLogs,
    queryLogsByType,
    getAllLogs
};
