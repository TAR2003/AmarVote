'use strict';

const { Contract } = require('fabric-contract-api');

class ElectionLogContract extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        console.info('============= END : Initialize Ledger ===========');
        return JSON.stringify({ success: true, message: 'Ledger initialized' });
    }

    // Log election creation
    async logElectionCreated(ctx, electionId, electionName, organizerName, startDate, endDate) {
        console.info('============= START : Log Election Created ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'ELECTION_CREATED',
            electionId: electionId,
            electionName: electionName,
            organizerName: organizerName,
            startDate: startDate,
            endDate: endDate,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_CREATED_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Election Created ===========');
        return JSON.stringify(logEntry);
    }

    // Log ballot received
    async logBallotReceived(ctx, electionId, trackingCode, ballotHash, voterId) {
        console.info('============= START : Log Ballot Received ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'BALLOT_RECEIVED',
            electionId: electionId,
            trackingCode: trackingCode,
            ballotHash: ballotHash,
            voterId: voterId || 'anonymous',
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_BALLOT_${trackingCode}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Ballot Received ===========');
        return JSON.stringify(logEntry);
    }

    // Log election ended
    async logElectionEnded(ctx, electionId, totalVotes, endedBy) {
        console.info('============= START : Log Election Ended ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'ELECTION_ENDED',
            electionId: electionId,
            totalVotes: totalVotes,
            endedBy: endedBy,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_ENDED_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Election Ended ===========');
        return JSON.stringify(logEntry);
    }

    // Log election started
    async logElectionStarted(ctx, electionId, startedBy) {
        console.info('============= START : Log Election Started ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'ELECTION_STARTED',
            electionId: electionId,
            startedBy: startedBy,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_STARTED_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Election Started ===========');
        return JSON.stringify(logEntry);
    }

    // Log ballot audited (Benaloh challenge)
    async logBallotAudited(ctx, electionId, trackingCode, ballotHash) {
        console.info('============= START : Log Ballot Audited ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'BALLOT_AUDITED',
            electionId: electionId,
            trackingCode: trackingCode,
            ballotHash: ballotHash,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_AUDIT_${trackingCode}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Ballot Audited ===========');
        return JSON.stringify(logEntry);
    }

    // Log encrypted ballot created
    async logEncryptedBallotCreated(ctx, electionId, trackingCode, ballotHash, voterEmail) {
        console.info('============= START : Log Encrypted Ballot Created ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'ENCRYPTED_BALLOT_CREATED',
            electionId: electionId,
            trackingCode: trackingCode,
            ballotHash: ballotHash,
            voterEmail: voterEmail,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_ENCRYPTED_${trackingCode}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Encrypted Ballot Created ===========');
        return JSON.stringify(logEntry);
    }

    // Log Benaloh challenge
    async logBenalohChallenge(ctx, electionId, trackingCode, ballotHash, voterEmail, challengeSucceeded) {
        console.info('============= START : Log Benaloh Challenge ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'BENALOH_CHALLENGE',
            electionId: electionId,
            trackingCode: trackingCode,
            ballotHash: ballotHash,
            voterEmail: voterEmail,
            challengeSucceeded: challengeSucceeded === 'true',
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_BENALOH_${trackingCode}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Benaloh Challenge ===========');
        return JSON.stringify(logEntry);
    }

    // Log guardian key submitted
    async logGuardianKeySubmitted(ctx, electionId, guardianEmail, guardianId, publicKeyHash) {
        console.info('============= START : Log Guardian Key Submitted ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'GUARDIAN_KEY_SUBMITTED',
            electionId: electionId,
            guardianEmail: guardianEmail,
            guardianId: guardianId,
            publicKeyHash: publicKeyHash,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_GUARDIAN_${guardianId}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Guardian Key Submitted ===========');
        return JSON.stringify(logEntry);
    }

    // Log ballot cast
    async logBallotCast(ctx, electionId, trackingCode, ballotHash, voterEmail) {
        console.info('============= START : Log Ballot Cast ===========');

        const logEntry = {
            docType: 'electionLog',
            logType: 'BALLOT_CAST',
            electionId: electionId,
            trackingCode: trackingCode,
            ballotHash: ballotHash,
            voterEmail: voterEmail,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID()
        };

        const key = `LOG_${electionId}_CAST_${trackingCode}_${Date.now()}`;
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(logEntry)));
        
        console.info('============= END : Log Ballot Cast ===========');
        return JSON.stringify(logEntry);
    }

    // Get all logs for a specific election
    async getElectionLogs(ctx, electionId) {
        console.info('============= START : Get Election Logs ===========');

        const queryString = {
            selector: {
                docType: 'electionLog',
                electionId: electionId
            },
            sort: [{ timestamp: 'asc' }]
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                allResults.push(record);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        console.info('============= END : Get Election Logs ===========');
        return JSON.stringify(allResults);
    }

    // Get a specific log entry
    async getLogEntry(ctx, key) {
        const logAsBytes = await ctx.stub.getState(key);
        if (!logAsBytes || logAsBytes.length === 0) {
            throw new Error(`Log entry ${key} does not exist`);
        }
        return logAsBytes.toString();
    }

    // Query logs by type
    async queryLogsByType(ctx, electionId, logType) {
        console.info('============= START : Query Logs By Type ===========');

        const queryString = {
            selector: {
                docType: 'electionLog',
                electionId: electionId,
                logType: logType
            },
            sort: [{ timestamp: 'asc' }]
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                allResults.push(record);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        console.info('============= END : Query Logs By Type ===========');
        return JSON.stringify(allResults);
    }

    // Get all logs (admin function)
    async getAllLogs(ctx) {
        console.info('============= START : Get All Logs ===========');

        const queryString = {
            selector: {
                docType: 'electionLog'
            },
            sort: [{ timestamp: 'desc' }]
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                allResults.push(record);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        console.info('============= END : Get All Logs ===========');
        return JSON.stringify(allResults);
    }

    // Get blockchain info for a specific transaction
    async getTransactionInfo(ctx, txId) {
        console.info('============= START : Get Transaction Info ===========');
        
        const queryString = {
            selector: {
                docType: 'electionLog',
                txId: txId
            }
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
                allResults.push(record);
            } catch (err) {
                console.log(err);
            }
            result = await iterator.next();
        }
        
        await iterator.close();
        console.info('============= END : Get Transaction Info ===========');
        return JSON.stringify(allResults);
    }
}

module.exports = ElectionLogContract;
