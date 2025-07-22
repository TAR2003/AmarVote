// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VotingContract
 * @dev A secure voting contract that records ballots with tracking codes
 */
contract VotingContract {
    struct Ballot {
        string electionId;
        string trackingCode;
        string ballotHash;
        uint256 timestamp;
        bool exists;
    }
    
    // Mapping from tracking code to ballot data
    mapping(string => Ballot) public ballots;
    
    // Mapping to track if a ballot hash exists for an election
    mapping(string => mapping(string => bool)) public electionBallotExists;
    
    // Only the contract owner (backend) can record ballots
    address public owner;
    
    // Events
    event BallotRecorded(
        string indexed electionId,
        string trackingCode,
        string ballotHash,
        uint256 timestamp
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Record a new ballot (only callable by owner/backend)
     * @param _electionId The election identifier
     * @param _trackingCode Unique tracking code for the ballot
     * @param _ballotHash Hash of the ballot content
     */
    function recordBallot(
        string memory _electionId,
        string memory _trackingCode,
        string memory _ballotHash
    ) public onlyOwner {
        require(bytes(_electionId).length > 0, "Election ID cannot be empty");
        require(bytes(_trackingCode).length > 0, "Tracking code cannot be empty");
        require(bytes(_ballotHash).length > 0, "Ballot hash cannot be empty");
        require(!ballots[_trackingCode].exists, "Tracking code already exists");
        require(!electionBallotExists[_electionId][_ballotHash], "Ballot already exists for this election");
        
        uint256 currentTimestamp = block.timestamp;
        
        ballots[_trackingCode] = Ballot({
            electionId: _electionId,
            trackingCode: _trackingCode,
            ballotHash: _ballotHash,
            timestamp: currentTimestamp,
            exists: true
        });
        
        electionBallotExists[_electionId][_ballotHash] = true;
        
        emit BallotRecorded(_electionId, _trackingCode, _ballotHash, currentTimestamp);
    }
    
    /**
     * @dev Verify a ballot exists and return its details (callable by anyone)
     * @param _electionId The election identifier
     * @param _trackingCode The tracking code to verify
     * @param _ballotHash The ballot hash to verify
     * @return exists Whether the ballot exists
     * @return timestamp The timestamp when the ballot was recorded
     */
    function verifyBallot(
        string memory _electionId,
        string memory _trackingCode,
        string memory _ballotHash
    ) public view returns (bool exists, uint256 timestamp) {
        require(bytes(_electionId).length > 0, "Election ID cannot be empty");
        require(bytes(_trackingCode).length > 0, "Tracking code cannot be empty");
        require(bytes(_ballotHash).length > 0, "Ballot hash cannot be empty");
        
        Ballot memory ballot = ballots[_trackingCode];
        
        if (ballot.exists && 
            keccak256(bytes(ballot.electionId)) == keccak256(bytes(_electionId)) &&
            keccak256(bytes(ballot.ballotHash)) == keccak256(bytes(_ballotHash))) {
            return (true, ballot.timestamp);
        }
        
        return (false, 0);
    }
    
    /**
     * @dev Get ballot details by tracking code (callable by anyone)
     * @param _trackingCode The tracking code
     * @return electionId The election ID
     * @return ballotHash The ballot hash
     * @return timestamp The timestamp
     * @return exists Whether the ballot exists
     */
    function getBallotByTrackingCode(string memory _trackingCode) 
        public view returns (string memory electionId, string memory ballotHash, uint256 timestamp, bool exists) {
        require(bytes(_trackingCode).length > 0, "Tracking code cannot be empty");
        
        Ballot memory ballot = ballots[_trackingCode];
        return (ballot.electionId, ballot.ballotHash, ballot.timestamp, ballot.exists);
    }
    
    /**
     * @dev Check if a ballot hash exists for a specific election
     * @param _electionId The election identifier
     * @param _ballotHash The ballot hash to check
     * @return Whether the ballot exists for the election
     */
    function ballotExistsForElection(string memory _electionId, string memory _ballotHash) 
        public view returns (bool) {
        return electionBallotExists[_electionId][_ballotHash];
    }
}
