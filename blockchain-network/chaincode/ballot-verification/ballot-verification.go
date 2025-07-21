package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// BallotVerificationContract provides functions for managing ballot verification
type BallotVerificationContract struct {
	contractapi.Contract
}

// BallotRecord represents a ballot record stored on the blockchain
type BallotRecord struct {
	ElectionID   string    `json:"electionId"`
	TrackingCode string    `json:"trackingCode"`
	BallotHash   string    `json:"ballotHash"`
	Timestamp    time.Time `json:"timestamp"`
	Verified     bool      `json:"verified"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// InitLedger adds initial data to the ledger
func (bc *BallotVerificationContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	log.Println("BallotVerificationContract: InitLedger called")
	return nil
}

// RecordBallot stores a new ballot record on the blockchain
func (bc *BallotVerificationContract) RecordBallot(ctx contractapi.TransactionContextInterface, electionID, trackingCode, ballotHash string) error {
	// Check if ballot already exists
	existing, err := ctx.GetStub().GetState(trackingCode)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}

	if existing != nil {
		return fmt.Errorf("ballot with tracking code %s already exists", trackingCode)
	}

	// Create ballot record
	ballot := BallotRecord{
		ElectionID:   electionID,
		TrackingCode: trackingCode,
		BallotHash:   ballotHash,
		Timestamp:    time.Now(),
		Verified:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	ballotJSON, err := json.Marshal(ballot)
	if err != nil {
		return fmt.Errorf("failed to marshal ballot: %v", err)
	}

	// Store ballot on the blockchain
	return ctx.GetStub().PutState(trackingCode, ballotJSON)
}

// GetBallot retrieves a ballot record by tracking code
func (bc *BallotVerificationContract) GetBallot(ctx contractapi.TransactionContextInterface, trackingCode string) (*BallotRecord, error) {
	ballotJSON, err := ctx.GetStub().GetState(trackingCode)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}

	if ballotJSON == nil {
		return nil, fmt.Errorf("ballot with tracking code %s does not exist", trackingCode)
	}

	var ballot BallotRecord
	err = json.Unmarshal(ballotJSON, &ballot)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal ballot: %v", err)
	}

	return &ballot, nil
}

// VerifyBallot verifies if a ballot exists and matches the provided hash
func (bc *BallotVerificationContract) VerifyBallot(ctx contractapi.TransactionContextInterface, trackingCode, ballotHash string) (bool, error) {
	ballot, err := bc.GetBallot(ctx, trackingCode)
	if err != nil {
		return false, err
	}

	// Check if hash matches
	if ballot.BallotHash == ballotHash {
		return true, nil
	}

	return false, fmt.Errorf("ballot hash mismatch for tracking code %s", trackingCode)
}

// GetBallotsByElection retrieves all ballots for a specific election
func (bc *BallotVerificationContract) GetBallotsByElection(ctx contractapi.TransactionContextInterface, electionID string) ([]*BallotRecord, error) {
	// Query by election ID using rich query (requires CouchDB)
	queryString := fmt.Sprintf(`{"selector":{"electionId":"%s"}}`, electionID)
	
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to get query result: %v", err)
	}
	defer resultsIterator.Close()

	var ballots []*BallotRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to get next query result: %v", err)
		}

		var ballot BallotRecord
		err = json.Unmarshal(queryResponse.Value, &ballot)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal ballot: %v", err)
		}
		ballots = append(ballots, &ballot)
	}

	return ballots, nil
}

// GetAllBallots retrieves all ballot records
func (bc *BallotVerificationContract) GetAllBallots(ctx contractapi.TransactionContextInterface) ([]*BallotRecord, error) {
	// Range query with empty string for startKey and endKey returns all the keys
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var ballots []*BallotRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to get next query result: %v", err)
		}

		var ballot BallotRecord
		err = json.Unmarshal(queryResponse.Value, &ballot)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal ballot: %v", err)
		}
		ballots = append(ballots, &ballot)
	}

	return ballots, nil
}

// UpdateBallotVerification updates the verification status of a ballot
func (bc *BallotVerificationContract) UpdateBallotVerification(ctx contractapi.TransactionContextInterface, trackingCode string, verified bool) error {
	ballot, err := bc.GetBallot(ctx, trackingCode)
	if err != nil {
		return err
	}

	ballot.Verified = verified
	ballot.UpdatedAt = time.Now()

	ballotJSON, err := json.Marshal(ballot)
	if err != nil {
		return fmt.Errorf("failed to marshal ballot: %v", err)
	}

	return ctx.GetStub().PutState(trackingCode, ballotJSON)
}

// GetBallotHistory returns the transaction history for a ballot
func (bc *BallotVerificationContract) GetBallotHistory(ctx contractapi.TransactionContextInterface, trackingCode string) ([]map[string]interface{}, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(trackingCode)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for key %s: %v", trackingCode, err)
	}
	defer resultsIterator.Close()

	var history []map[string]interface{}
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to get next history result: %v", err)
		}

		record := map[string]interface{}{
			"txId":      response.TxId,
			"timestamp": response.Timestamp,
			"isDelete":  response.IsDelete,
		}

		if response.Value != nil {
			var ballot BallotRecord
			err = json.Unmarshal(response.Value, &ballot)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal ballot history: %v", err)
			}
			record["value"] = ballot
		}

		history = append(history, record)
	}

	return history, nil
}

func main() {
	ballotContract := new(BallotVerificationContract)

	cc, err := contractapi.NewChaincode(ballotContract)
	if err != nil {
		panic(err.Error())
	}

	if err := cc.Start(); err != nil {
		panic(err.Error())
	}
}
