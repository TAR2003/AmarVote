# Guardian Data Combined Encryption Implementation Summary

## Overview
This document summarizes the changes made to the backend code to support combined encryption of guardian private keys and polynomials as specified in the requirements.

## Changes Made

### 1. ElectionGuardCryptoService.java

#### New Methods Added:
- `encryptGuardianData(String privateKey, String polynomial)` - Encrypts both private key and polynomial together
- `decryptGuardianData(String encryptedData, String credentials)` - Decrypts and parses combined data
- `createCombinedGuardianString(String privateKey, String polynomial)` - Creates the formatted string
- `parseCombinedGuardianString(String combinedString)` - Parses the combined string back to components

#### New Result Class:
- `GuardianDecryptionResult` - Contains both private key and polynomial after decryption

#### String Format Used:
```
===Private Key===
{private_key_value}
===Polynomial===
{polynomial_value}
```

#### Backward Compatibility:
- Original `encryptPrivateKey()` and `decryptPrivateKey()` methods marked as `@Deprecated` but still functional
- Existing functionality remains intact

### 2. ElectionService.java

#### Changes in Guardian Setup:
- Now calls `cryptoService.encryptGuardianData(privateKey, polynomial)` instead of `encryptPrivateKey()`
- Combines both private key and polynomial before encryption
- Sends the combined encrypted data in credential files to guardians
- Stores credentials in database for later use during decryption

#### Data Flow:
1. ElectionGuard service returns private keys and polynomials
2. Backend creates combined string format for each guardian
3. Backend encrypts combined string using microservice
4. Backend sends encrypted credential file to guardian via email
5. Backend stores decryption credentials in database

### 3. PartialDecryptionService.java

#### Changes in Partial Decryption:
- Now calls `cryptoService.decryptGuardianData()` instead of `decryptPrivateKey()`
- Parses decrypted data to extract both private key and polynomial
- Uses decrypted polynomial in microservice calls instead of stored polynomial
- Passes decrypted polynomial to compensated decryption methods

#### Method Signature Updates:
- `createCompensatedDecryptionShares()` - Added polynomial parameter
- `createCompensatedShare()` - Added polynomial parameter
- Uses decrypted polynomial when available, falls back to stored polynomial for backward compatibility

## Implementation Details

### Security Considerations:
- The combined string is encrypted using the same microservice encryption as before
- Credentials are stored in database for decryption during partial/compensated decryption
- The format uses clear delimiters that are unlikely to appear in the actual data

### Error Handling:
- Proper validation of combined string format during parsing
- Clear error messages for invalid credential files
- Fallback to stored polynomial if decrypted polynomial not available

### Testing:
- Created test case to verify combined string format and parsing logic
- Compilation successful without errors
- Backward compatibility maintained

## Benefits of This Implementation:
1. **Security**: Both private key and polynomial encrypted together
2. **Simplicity**: Single credential file per guardian
3. **Consistency**: Same encryption/decryption flow for both data types  
4. **Backward Compatibility**: Existing functionality preserved
5. **Clear Format**: Easy to parse and understand the combined data structure

## Usage Flow:

### During Guardian Setup:
1. ElectionGuard returns private keys and polynomials
2. Backend creates combined format: `===Private Key===\n{key}\n===Polynomial===\n{polynomial}`
3. Backend encrypts combined string
4. Guardian receives encrypted credential file via email
5. Credentials stored in database

### During Partial Decryption:
1. Guardian uploads credential file with encrypted combined data
2. Backend retrieves stored credentials from database
3. Backend decrypts combined data using microservice
4. Backend parses decrypted string to extract private key and polynomial
5. Backend uses both values in ElectionGuard microservice calls

### During Compensated Decryption:
1. Uses previously decrypted private key and polynomial
2. Creates compensated shares using actual decrypted polynomial
3. Maintains backward compatibility with stored polynomial if needed

All changes have been implemented and tested successfully. The system now supports the required combined encryption of guardian private keys and polynomials while maintaining full backward compatibility.
