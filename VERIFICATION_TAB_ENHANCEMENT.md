# Enhanced Verification Tab Documentation

## Overview
The verification tab in AmarVote has been enhanced to provide comprehensive guardian and compensated decryption information for election transparency and auditing purposes.

## New Features

### 1. Guardian Information Display
- **Endpoint**: `/api/election/{id}/guardians`
- **Component**: `GuardianDataDisplay`
- **Features**:
  - Displays all guardian data except sensitive credentials
  - Expandable/collapsible fields for large data
  - Individual field downloads in JSON format
  - Complete guardian data download
  - Professional table format with user-friendly layout
  - Real-time loading states and error handling

### 2. Compensated Decryption Display
- **Endpoint**: `/api/election/{id}/compensated-decryptions`
- **Component**: `CompensatedDecryptionDisplay`
- **Features**:
  - Shows compensated decryption shares created by guardians
  - Grouped by missing guardian for better organization
  - Download functionality for individual shares and complete data
  - Professional layout with guardian identification
  - Explains the purpose of compensated decryptions

## Guardian Fields Displayed
- Guardian ID and sequence order
- User information (name and email)
- Guardian public key
- Guardian decryption key
- Partial decrypted tally
- Tally share
- Ballot share
- Key backup data
- Cryptographic proof
- Decryption status

## Compensated Decryption Fields Displayed
- Election ID
- Compensating guardian sequence and details
- Missing guardian sequence and details
- Compensated tally share
- Compensated ballot share

## Security Considerations
- **Excluded Fields**: Guardian credentials are intentionally excluded for security
- **Data Sanitization**: All displayed data is safe for public verification
- **Access Control**: Only accessible after election results are computed
- **Download Security**: Files are named with clear identification

## Download Features
- **Individual Field Downloads**: Each field can be downloaded as a separate JSON file
- **Complete Record Downloads**: Full guardian/compensation data can be downloaded
- **Batch Downloads**: All guardians or all compensated decryptions can be downloaded together
- **Structured Naming**: Files include election ID, guardian sequence, and field names
- **Timestamped Data**: All downloads include generation timestamps

## Usage
1. Navigate to election page
2. Click on "Verification" tab
3. Scroll to Guardian Information and Compensated Decryption sections
4. Use expand/collapse buttons for large data fields
5. Use download buttons for individual fields or complete records

## Technical Implementation
- **Backend**: Spring Boot REST endpoints in `ElectionController`
- **Service Layer**: Methods in `ElectionService` with repository queries
- **Frontend**: React components with modern UI/UX
- **Data Handling**: Proper handling of large text fields with truncation and expansion
- **Error Handling**: Graceful error states and loading indicators
- **Responsive Design**: Professional layout that works on all screen sizes

## File Structure
```
backend/
├── controller/ElectionController.java (new endpoints)
├── service/ElectionService.java (new methods)
└── repository/GuardianRepository.java (existing)
└── repository/CompensatedDecryptionRepository.java (existing)

frontend/
├── components/GuardianDataDisplay.jsx (new)
├── components/CompensatedDecryptionDisplay.jsx (new)
├── pages/ElectionPage.jsx (modified)
└── utils/electionApi.js (new endpoints)
```

## API Documentation

### GET /api/election/{id}/guardians
Returns guardian information for the specified election, excluding sensitive credentials.

**Response Format:**
```json
{
  "success": true,
  "guardians": [
    {
      "id": 1,
      "electionId": 123,
      "userId": 456,
      "sequenceOrder": 1,
      "guardianPublicKey": "...",
      "decryptedOrNot": true,
      "partialDecryptedTally": "...",
      "proof": "...",
      "guardianDecryptionKey": "...",
      "tallyShare": "...",
      "ballotShare": "...",
      "keyBackup": "...",
      "userEmail": "guardian@example.com",
      "userName": "Guardian Name"
    }
  ]
}
```

### GET /api/election/{id}/compensated-decryptions
Returns compensated decryption shares for the specified election.

**Response Format:**
```json
{
  "success": true,
  "compensatedDecryptions": [
    {
      "electionId": 123,
      "compensatingGuardianSequence": 1,
      "missingGuardianSequence": 2,
      "compensatedTallyShare": "...",
      "compensatedBallotShare": "...",
      "compensatingGuardianEmail": "guardian1@example.com",
      "compensatingGuardianName": "Guardian 1",
      "missingGuardianEmail": "guardian2@example.com",
      "missingGuardianName": "Guardian 2"
    }
  ]
}
```

This implementation provides a comprehensive, secure, and user-friendly way to display and download critical election verification data.