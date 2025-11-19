// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VotingContract
 * @dev A secure voting contract that records ballots with tracking codes and maintains election logs
 */
contract VotingContract {
    struct Ballot {
        string electionId;
        string trackingCode;
        string ballotHash;
        uint256 timestamp;
        bool exists;
    }
    
    struct ElectionLog {
        string message;
        uint256 timestamp;
    }
    
    // Mapping from electionId to tracking code to ballot data
    mapping(string => mapping(string => Ballot)) public ballots;
    
    // Mapping to track if a tracking code exists for an election
    mapping(string => mapping(string => bool)) public electionTrackingCodeExists;
    
    // Mapping to track if an election exists
    mapping(string => bool) public electionExists;
    
    // Mapping from election ID to array of logs
    mapping(string => ElectionLog[]) public electionLogs;
    
    // Only the contract owner (backend) can record ballots and create elections
    address public owner;
    
    // Events
    event BallotRecorded(
        string indexed electionId,
        string trackingCode,
        string ballotHash,
        uint256 timestamp
    );
    
    event ElectionCreated(
        string indexed electionId,
        uint256 timestamp
    );
    
    event LogAdded(
        string indexed electionId,
        string message,
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
     * @dev Create a new election (only callable by owner/backend)
     * @param _electionId The election identifier
     */
    function createElection(string memory _electionId) public onlyOwner {
        require(bytes(_electionId).length > 0, "Election ID cannot be empty");
        require(!electionExists[_electionId], "Election already exists");
        
        uint256 currentTimestamp = block.timestamp;
        electionExists[_electionId] = true;
        
        // Add creation log
        string memory creationMessage = string(abi.encodePacked(
            "A new election with election-id = ", 
            _electionId, 
            " is created at ", 
            toString(currentTimestamp)
        ));
        
        electionLogs[_electionId].push(ElectionLog({
            message: creationMessage,
            timestamp: currentTimestamp
        }));
        
        emit ElectionCreated(_electionId, currentTimestamp);
        emit LogAdded(_electionId, creationMessage, currentTimestamp);
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
        require(electionExists[_electionId], "Election does not exist");
        require(!electionTrackingCodeExists[_electionId][_trackingCode], "Tracking code already exists for this election");
        
        uint256 currentTimestamp = block.timestamp;
        
        ballots[_electionId][_trackingCode] = Ballot({
            electionId: _electionId,
            trackingCode: _trackingCode,
            ballotHash: _ballotHash,
            timestamp: currentTimestamp,
            exists: true
        });
        
        electionTrackingCodeExists[_electionId][_trackingCode] = true;
        
        // Add ballot recording log
        string memory ballotMessage = string(abi.encodePacked(
            "A new ballot with tracking code = ", 
            _trackingCode, 
            ", ballot-hash = ", 
            _ballotHash, 
            " has been cast at ", 
            toString(currentTimestamp)
        ));
        
        electionLogs[_electionId].push(ElectionLog({
            message: ballotMessage,
            timestamp: currentTimestamp
        }));
        
        emit BallotRecorded(_electionId, _trackingCode, _ballotHash, currentTimestamp);
        emit LogAdded(_electionId, ballotMessage, currentTimestamp);
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
        
        Ballot memory ballot = ballots[_electionId][_trackingCode];
        
        if (ballot.exists && 
            keccak256(bytes(ballot.ballotHash)) == keccak256(bytes(_ballotHash))) {
            return (true, ballot.timestamp);
        }
        
        return (false, 0);
    }
    
    /**
     * @dev Get ballot details by election ID and tracking code (callable by anyone)
     * @param _electionId The election identifier
     * @param _trackingCode The tracking code
     * @return electionId The election ID
     * @return ballotHash The ballot hash
     * @return timestamp The timestamp
     * @return exists Whether the ballot exists
     */
    function getBallotByTrackingCode(string memory _electionId, string memory _trackingCode) 
        public view returns (string memory electionId, string memory ballotHash, uint256 timestamp, bool exists) {
        require(bytes(_electionId).length > 0, "Election ID cannot be empty");
        require(bytes(_trackingCode).length > 0, "Tracking code cannot be empty");
        
        Ballot memory ballot = ballots[_electionId][_trackingCode];
        return (ballot.electionId, ballot.ballotHash, ballot.timestamp, ballot.exists);
    }
    
    /**
     * @dev Check if a tracking code exists for a specific election
     * @param _electionId The election identifier
     * @param _trackingCode The tracking code to check
     * @return Whether the tracking code exists for the election
     */
    function trackingCodeExistsForElection(string memory _electionId, string memory _trackingCode) 
        public view returns (bool) {
        return electionTrackingCodeExists[_electionId][_trackingCode];
    }
    
    /**
     * @dev Get all logs for an election
     * @param _electionId The election identifier
     * @return messages Array of log messages
     * @return timestamps Array of corresponding timestamps
     */
    function getElectionLogs(string memory _electionId) 
        public view returns (string[] memory messages, uint256[] memory timestamps) {
        require(bytes(_electionId).length > 0, "Election ID cannot be empty");
        require(electionExists[_electionId], "Election does not exist");
        
        uint256 logCount = electionLogs[_electionId].length;
        messages = new string[](logCount);
        timestamps = new uint256[](logCount);
        
        for (uint256 i = 0; i < logCount; i++) {
            messages[i] = electionLogs[_electionId][i].message;
            timestamps[i] = electionLogs[_electionId][i].timestamp;
        }
        
        return (messages, timestamps);
    }
    
    /**
     * @dev Get the number of logs for an election
     * @param _electionId The election identifier
     * @return The number of logs
     */
    function getElectionLogCount(string memory _electionId) public view returns (uint256) {
        require(electionExists[_electionId], "Election does not exist");
        return electionLogs[_electionId].length;
    }
    
    /**
     * @dev Check if an election exists
     * @param _electionId The election identifier
     * @return Whether the election exists
     */
    function checkElectionExists(string memory _electionId) public view returns (bool) {
        return electionExists[_electionId];
    }
    
    /**
     * @dev Convert uint256 to string
     * @param _i The integer to convert
     * @return _uintAsString The string representation
     */
    function toString(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}