// contracts/BallotTracker.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract BallotTracker {
    struct BallotRecord {
        string electionId;
        string trackingCode;
        string ballotHash;
        uint256 timestamp;
    }
    
    BallotRecord[] public ballotRecords;
    
    event BallotRecorded(
        uint256 indexed index,
        string electionId,
        string trackingCode,
        string ballotHash,
        uint256 timestamp
    );
    
    function recordBallot(
        string memory _electionId,
        string memory _trackingCode,
        string memory _ballotHash
    ) public returns (uint256) {
        uint256 timestamp = block.timestamp;
        ballotRecords.push(BallotRecord(
            _electionId,
            _trackingCode,
            _ballotHash,
            timestamp
        ));
        
        uint256 index = ballotRecords.length - 1;
        emit BallotRecorded(index, _electionId, _trackingCode, _ballotHash, timestamp);
        return index;
    }
    
    function getBallotRecord(uint256 index) public view returns (
        string memory,
        string memory,
        string memory,
        uint256
    ) {
        BallotRecord memory record = ballotRecords[index];
        return (
            record.electionId,
            record.trackingCode,
            record.ballotHash,
            record.timestamp
        );
    }
    
    function verifyBallot(
        string memory _electionId,
        string memory _trackingCode,
        string memory _ballotHash
    ) public view returns (bool, uint256) {
        for (uint256 i = 0; i < ballotRecords.length; i++) {
            BallotRecord memory record = ballotRecords[i];
            if (keccak256(abi.encodePacked(record.electionId)) == keccak256(abi.encodePacked(_electionId)) &&
                keccak256(abi.encodePacked(record.trackingCode)) == keccak256(abi.encodePacked(_trackingCode)) &&
                keccak256(abi.encodePacked(record.ballotHash)) == keccak256(abi.encodePacked(_ballotHash))) {
                return (true, record.timestamp);
            }
        }
        return (false, 0);
    }
    
    function getRecordCount() public view returns (uint256) {
        return ballotRecords.length;
    }
}