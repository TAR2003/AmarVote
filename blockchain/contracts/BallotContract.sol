// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title BallotContract
 * @dev Enhanced ballot recording and verification contract with privacy and security features
 */
contract BallotContract is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct Ballot {
        bytes32 ballotCommitment;  // Cryptographic commitment instead of plain hash
        uint256 timestamp;
        address voterAddress;      // For voter authentication
        bool exists;
        string electionId;         // Store for audit purposes
    }

    struct Election {
        bool isActive;
        uint256 startTime;
        uint256 endTime;
        mapping(address => bool) registeredVoters;
        mapping(bytes32 => bool) usedTrackingCodes;
    }

    // Main storage: composite key -> ballot
    mapping(bytes32 => Ballot) private ballots;
    
    // Election management
    mapping(string => Election) private elections;
    
    // Events for transparency and off-chain indexing
    event BallotRecorded(
        string indexed electionId,
        bytes32 indexed trackingCodeHash,
        bytes32 ballotCommitment,
        uint256 timestamp,
        address indexed voter
    );
    
    event ElectionCreated(
        string indexed electionId,
        uint256 startTime,
        uint256 endTime
    );
    
    event VoterRegistered(
        string indexed electionId,
        address indexed voter
    );

    modifier onlyDuringElection(string memory electionId) {
        Election storage election = elections[electionId];
        require(election.isActive, "Election is not active");
        require(block.timestamp >= election.startTime, "Election has not started");
        require(block.timestamp <= election.endTime, "Election has ended");
        _;
    }

    modifier onlyRegisteredVoter(string memory electionId) {
        require(elections[electionId].registeredVoters[msg.sender], "Voter not registered");
        _;
    }

    constructor() {
        // Contract is ready for deployment
    }

    /**
     * @dev Create a new election with time boundaries
     */
    function createElection(
        string memory electionId,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        require(bytes(electionId).length > 0, "Election ID required");
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");
        require(!elections[electionId].isActive, "Election already exists");

        Election storage election = elections[electionId];
        election.isActive = true;
        election.startTime = startTime;
        election.endTime = endTime;

        emit ElectionCreated(electionId, startTime, endTime);
    }

    /**
     * @dev Register a voter for a specific election
     */
    function registerVoter(string memory electionId, address voter) external onlyOwner {
        require(elections[electionId].isActive, "Election does not exist");
        elections[electionId].registeredVoters[voter] = true;
        
        emit VoterRegistered(electionId, voter);
    }

    /**
     * @dev Record a ballot with enhanced security and privacy
     */
    function recordBallot(
        string memory electionId,
        string memory trackingCode,
        bytes32 ballotCommitment,
        bytes memory signature
    ) external nonReentrant onlyDuringElection(electionId) onlyRegisteredVoter(electionId) {
        require(bytes(electionId).length > 0, "Election ID required");
        require(bytes(trackingCode).length > 0, "Tracking code required");
        require(ballotCommitment != bytes32(0), "Ballot commitment required");

        // Create domain-separated composite key
        bytes32 compositeKey = keccak256(
            abi.encodePacked(
                "BALLOT_KEY",
                electionId,
                "|",
                trackingCode
            )
        );

        // Verify the tracking code hasn't been used
        bytes32 trackingHash = keccak256(abi.encodePacked(trackingCode));
        require(!elections[electionId].usedTrackingCodes[trackingHash], "Tracking code already used");

        // Verify signature to ensure voter authorization
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(electionId, trackingCode, ballotCommitment))
            )
        );
        address signer = messageHash.recover(signature);
        require(signer == msg.sender, "Invalid signature");

        // Ensure ballot doesn't already exist
        require(!ballots[compositeKey].exists, "Ballot already recorded");

        // Record the ballot
        ballots[compositeKey] = Ballot({
            ballotCommitment: ballotCommitment,
            timestamp: block.timestamp,
            voterAddress: msg.sender,
            exists: true,
            electionId: electionId
        });

        // Mark tracking code as used
        elections[electionId].usedTrackingCodes[trackingHash] = true;

        emit BallotRecorded(
            electionId,
            trackingHash,
            ballotCommitment,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @dev Verify a ballot exists and matches the commitment
     */
    function verifyBallot(
        string memory electionId,
        string memory trackingCode,
        bytes32 ballotCommitment
    ) external view returns (bool exists, uint256 timestamp, address voter) {
        bytes32 compositeKey = keccak256(
            abi.encodePacked(
                "BALLOT_KEY",
                electionId,
                "|",
                trackingCode
            )
        );

        Ballot memory ballot = ballots[compositeKey];
        
        if (ballot.exists && ballot.ballotCommitment == ballotCommitment) {
            return (true, ballot.timestamp, ballot.voterAddress);
        }
        
        return (false, 0, address(0));
    }

    /**
     * @dev Get ballot record without revealing the commitment (for auditing)
     */
    function getBallotRecord(
        string memory electionId,
        string memory trackingCode
    ) external view returns (bool exists, uint256 timestamp, address voter) {
        bytes32 compositeKey = keccak256(
            abi.encodePacked(
                "BALLOT_KEY",
                electionId,
                "|",
                trackingCode
            )
        );

        Ballot memory ballot = ballots[compositeKey];
        
        if (ballot.exists) {
            return (true, ballot.timestamp, ballot.voterAddress);
        }
        
        return (false, 0, address(0));
    }

    /**
     * @dev Check if a voter is registered for an election
     */
    function isVoterRegistered(string memory electionId, address voter) external view returns (bool) {
        return elections[electionId].registeredVoters[voter];
    }

    /**
     * @dev Get election details
     */
    function getElectionDetails(string memory electionId) external view returns (
        bool isActive,
        uint256 startTime,
        uint256 endTime
    ) {
        Election storage election = elections[electionId];
        return (election.isActive, election.startTime, election.endTime);
    }

    /**
     * @dev Emergency function to close an election
     */
    function closeElection(string memory electionId) external onlyOwner {
        elections[electionId].isActive = false;
    }
}
