const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Blockchain configuration
const CHANNEL_NAME = 'amarvotechannel';
const CHAINCODE_NAME = 'ballot-verification';
const WALLET_PATH = path.join(__dirname, 'wallets');
const CONNECTION_PROFILE_PATH = path.join(__dirname, 'connection-profile.json');

// Logging utility
const log = {
    info: (msg, ...args) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args)
};

/**
 * Create a gateway connection to the Fabric network
 */
async function createGateway() {
    try {
        // Load connection profile
        const connectionProfile = JSON.parse(fs.readFileSync(CONNECTION_PROFILE_PATH, 'utf8'));
        
        // Create wallet
        const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);
        
        // Check for admin identity
        const identity = await wallet.get('admin');
        if (!identity) {
            throw new Error('Admin identity not found in wallet');
        }
        
        // Create gateway
        const gateway = new Gateway();
        await gateway.connect(connectionProfile, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true }
        });
        
        return gateway;
    } catch (error) {
        log.error('Failed to create gateway:', error.message);
        throw error;
    }
}

/**
 * Get contract instance
 */
async function getContract() {
    const gateway = await createGateway();
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);
    return { gateway, contract };
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const { gateway, contract } = await getContract();
        
        // Test a simple query
        await contract.evaluateTransaction('GetAllBallots');
        
        await gateway.disconnect();
        
        res.json({
            status: 'healthy',
            message: 'Blockchain network is operational',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log.error('Health check failed:', error.message);
        res.status(500).json({
            status: 'unhealthy',
            message: 'Blockchain network is not available',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Record ballot on blockchain
app.post('/record-ballot', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash, timestamp } = req.body;

        log.info('Incoming /record-ballot request body:', req.body);

        if (!electionId || !trackingCode || !ballotHash) {
            log.error('Missing required fields in /record-ballot:', req.body);
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: electionId, trackingCode, ballotHash',
                received: req.body
            });
        }

        log.info(`🔗 Recording ballot - Election: ${electionId}, Tracking: ${trackingCode}`);

        const { gateway, contract } = await getContract();

        // Submit transaction
        let result;
        try {
            result = await contract.submitTransaction(
                'RecordBallot',
                electionId,
                trackingCode,
                ballotHash
            );
        } catch (txError) {
            log.error('❌ Error during contract.submitTransaction:', txError.message, txError.stack);
            await gateway.disconnect();
            return res.status(500).json({
                success: false,
                message: 'Failed to submit RecordBallot transaction',
                error: txError.message,
                stack: txError.stack,
                timestamp: new Date().toISOString()
            });
        }

        await gateway.disconnect();

        const response = {
            success: true,
            message: 'Ballot recorded successfully',
            transactionId: `tx-${trackingCode}-${Date.now()}`,
            blockNumber: `block-${Date.now()}`,
            timestamp: new Date().toISOString(),
            result: result ? result.toString() : null
        };

        log.info(`✅ Ballot recorded successfully: ${trackingCode}`);
        res.json(response);

    } catch (error) {
        log.error('Failed to record ballot:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to record ballot on blockchain',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            received: req.body
        });
    }
});

// Verify ballot on blockchain
app.post('/verify-ballot', async (req, res) => {
    try {
        const { trackingCode, ballotHash } = req.body;
        
        if (!trackingCode || !ballotHash) {
            return res.status(400).json({
                verified: false,
                message: 'Missing required fields: trackingCode, ballotHash'
            });
        }
        
        log.info(`🔍 Verifying ballot - Tracking: ${trackingCode}`);
        
        const { gateway, contract } = await getContract();
        
        // Get ballot from blockchain
        const ballotResult = await contract.evaluateTransaction('GetBallot', trackingCode);
        const ballotData = ballotResult.toString();
        
        if (!ballotData || ballotData === 'null' || ballotData === '') {
            await gateway.disconnect();
            return res.json({
                verified: false,
                message: 'Ballot not found on blockchain',
                timestamp: new Date().toISOString()
            });
        }
        
        // Verify ballot hash
        const verifyResult = await contract.evaluateTransaction('VerifyBallot', trackingCode, ballotHash);
        const isValid = verifyResult.toString() === 'true';
        
        await gateway.disconnect();
        
        if (isValid) {
            // Parse ballot data to get timestamp
            let ballotTimestamp;
            try {
                const ballot = JSON.parse(ballotData);
                ballotTimestamp = ballot.timestamp || ballot.createdAt || new Date().toISOString();
            } catch (e) {
                ballotTimestamp = new Date().toISOString();
            }
            
            const response = {
                verified: true,
                message: 'Ballot verified on blockchain',
                timestamp: ballotTimestamp,
                transactionId: `tx-${trackingCode}`,
                blockNumber: `block-${Date.now()}`,
                verifiedAt: new Date().toISOString()
            };
            
            log.info(`✅ Ballot verified successfully: ${trackingCode}`);
            res.json(response);
        } else {
            log.warn(`⚠️ Ballot verification failed - hash mismatch: ${trackingCode}`);
            res.json({
                verified: false,
                message: 'Ballot hash mismatch',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        log.error('Failed to verify ballot:', error.message);
        res.status(500).json({
            verified: false,
            message: 'Blockchain verification failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get ballots for an election
app.get('/election/:electionId/ballots', async (req, res) => {
    try {
        const { electionId } = req.params;
        
        log.info(`📋 Getting ballots for election: ${electionId}`);
        
        const { gateway, contract } = await getContract();
        
        const result = await contract.evaluateTransaction('GetBallotsByElection', electionId);
        const ballots = JSON.parse(result.toString());
        
        await gateway.disconnect();
        
        log.info(`✅ Retrieved ${ballots.length || 0} ballots for election ${electionId}`);
        res.json({
            success: true,
            electionId,
            ballots: ballots || [],
            count: ballots ? ballots.length : 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        log.error('Failed to get election ballots:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve election ballots',
            error: error.message,
            ballots: [],
            timestamp: new Date().toISOString()
        });
    }
});

// Get all ballots
app.get('/ballots', async (req, res) => {
    try {
        log.info('📋 Getting all ballots from blockchain');
        
        const { gateway, contract } = await getContract();
        
        const result = await contract.evaluateTransaction('GetAllBallots');
        const ballots = JSON.parse(result.toString());
        
        await gateway.disconnect();
        
        log.info(`✅ Retrieved ${ballots.length || 0} total ballots`);
        res.json({
            success: true,
            ballots: ballots || [],
            count: ballots ? ballots.length : 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        log.error('Failed to get all ballots:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve ballots',
            error: error.message,
            ballots: [],
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    log.error('Unhandled error:', error.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    log.info(`🚀 Blockchain Gateway Service started on port ${PORT}`);
    log.info(`📡 Health check: http://localhost:${PORT}/health`);
    log.info(`🔗 Endpoints:
    POST /record-ballot - Record ballot on blockchain
    POST /verify-ballot - Verify ballot on blockchain
    GET  /election/:id/ballots - Get ballots for election
    GET  /ballots - Get all ballots
    GET  /health - Health check`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    log.info('🛑 Shutting down Blockchain Gateway Service...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    log.error('Unhandled Rejection:', error.message);
    process.exit(1);
});
