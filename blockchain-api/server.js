const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const fabricNetwork = require('./fabricNetwork');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', service: 'blockchain-api' });
});

// Initialize the ledger
app.post('/api/blockchain/init', async (req, res) => {
    try {
        const result = await fabricNetwork.initLedger();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to initialize ledger: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log election created
app.post('/api/blockchain/log/election-created', async (req, res) => {
    try {
        const { electionId, electionName, organizerName, startDate, endDate } = req.body;
        
        if (!electionId || !electionName || !organizerName || !startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logElectionCreated(
            electionId, electionName, organizerName, startDate, endDate
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log election created: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log ballot received
app.post('/api/blockchain/log/ballot-received', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash, voterId } = req.body;
        
        if (!electionId || !trackingCode || !ballotHash) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logBallotReceived(
            electionId, trackingCode, ballotHash, voterId || 'anonymous'
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log ballot received: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log election ended
app.post('/api/blockchain/log/election-ended', async (req, res) => {
    try {
        const { electionId, totalVotes, endedBy } = req.body;
        
        if (!electionId || totalVotes === undefined || !endedBy) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logElectionEnded(
            electionId, totalVotes.toString(), endedBy
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log election ended: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log election started
app.post('/api/blockchain/log/election-started', async (req, res) => {
    try {
        const { electionId, startedBy } = req.body;
        
        if (!electionId || !startedBy) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logElectionStarted(electionId, startedBy);
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log election started: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log ballot audited
app.post('/api/blockchain/log/ballot-audited', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash } = req.body;
        
        if (!electionId || !trackingCode || !ballotHash) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logBallotAudited(
            electionId, trackingCode, ballotHash
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log ballot audited: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log encrypted ballot created
app.post('/api/blockchain/log/encrypted-ballot-created', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash, voterEmail } = req.body;
        
        if (!electionId || !trackingCode || !ballotHash) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logEncryptedBallotCreated(
            electionId, trackingCode, ballotHash, voterEmail || 'anonymous'
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log encrypted ballot created: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log Benaloh challenge
app.post('/api/blockchain/log/benaloh-challenge', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash, voterEmail, challengeSucceeded } = req.body;
        
        if (!electionId || !trackingCode || !ballotHash || challengeSucceeded === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logBenalohChallenge(
            electionId, trackingCode, ballotHash, voterEmail || 'anonymous', 
            challengeSucceeded.toString()
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log Benaloh challenge: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log guardian key submitted
app.post('/api/blockchain/log/guardian-key-submitted', async (req, res) => {
    try {
        const { electionId, guardianEmail, guardianId, publicKeyHash } = req.body;
        
        if (!electionId || !guardianEmail || !guardianId || !publicKeyHash) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logGuardianKeySubmitted(
            electionId, guardianEmail, guardianId, publicKeyHash
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log guardian key submitted: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Log ballot cast
app.post('/api/blockchain/log/ballot-cast', async (req, res) => {
    try {
        const { electionId, trackingCode, ballotHash, voterEmail } = req.body;
        
        if (!electionId || !trackingCode || !ballotHash) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const result = await fabricNetwork.logBallotCast(
            electionId, trackingCode, ballotHash, voterEmail || 'anonymous'
        );
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to log ballot cast: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all logs for an election
app.get('/api/blockchain/logs/:electionId', async (req, res) => {
    try {
        const { electionId } = req.params;
        
        if (!electionId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Election ID is required' 
            });
        }

        const result = await fabricNetwork.getElectionLogs(electionId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to get election logs: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Query logs by type
app.get('/api/blockchain/logs/:electionId/:logType', async (req, res) => {
    try {
        const { electionId, logType } = req.params;
        
        if (!electionId || !logType) {
            return res.status(400).json({ 
                success: false, 
                error: 'Election ID and log type are required' 
            });
        }

        const result = await fabricNetwork.queryLogsByType(electionId, logType);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to query logs by type: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all logs (admin)
app.get('/api/blockchain/logs', async (req, res) => {
    try {
        const result = await fabricNetwork.getAllLogs();
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(`Failed to get all logs: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Blockchain API server is running on port ${PORT}`);
});

module.exports = app;
