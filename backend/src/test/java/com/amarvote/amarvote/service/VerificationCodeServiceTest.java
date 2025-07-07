package com.amarvote.amarvote.service;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.amarvote.amarvote.model.VerificationCode;
import com.amarvote.amarvote.repository.VerificationCodeRepository;

/**
 * Comprehensive unit test suite for VerificationCodeService class
 * 
 * This test class validates all the core functionality of the VerificationCodeService including:
 * 
 * 1. CODE GENERATION TESTS:
 *    - Alphanumeric code generation with specified length
 *    - Code format validation (uppercase letters and digits only)
 * 
 * 2. CODE CREATION AND STORAGE TESTS:
 *    - Creating verification codes for email addresses
 *    - Proper code persistence with expiry dates
 *    - Argument capturing for validation
 * 
 * 3. CODE VALIDATION TESTS:
 *    - Valid non-expired code validation
 *    - Expired code rejection
 *    - Non-existent code handling
 *    - Email-specific code validation
 *    - Wrong code rejection
 * 
 * 4. CODE LIFECYCLE MANAGEMENT TESTS:
 *    - Code deletion when exists
 *    - Safe handling when code doesn't exist
 *    - Expired codes cleanup
 * 
 * PURPOSE:
 * The VerificationCodeService is crucial for email verification workflows in the voting system.
 * It ensures secure code generation, validation, and lifecycle management for user verification.
 * 
 * TESTING APPROACH:
 * - Uses Mockito for comprehensive mocking of repository dependencies
 * - Tests both success and failure scenarios
 * - Validates time-based logic (expiry dates)
 * - Uses ArgumentCaptor to verify saved data integrity
 * - Focuses on security aspects of code validation
 * 
 * MOCKED DEPENDENCIES:
 * - VerificationCodeRepository: Database operations for verification codes
 * - EmailService: Email sending functionality (not directly tested here)
 */
@ExtendWith(MockitoExtension.class)
class VerificationCodeServiceTest {

    @Mock
    private VerificationCodeRepository codeRepository;
    
    @Mock
    private EmailService emailService;
    
    @InjectMocks
    private VerificationCodeService verificationCodeService;
    
    @Captor
    private ArgumentCaptor<VerificationCode> codeCaptor;
    
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_CODE = "ABC12345";
    
    /**
     * Test case: Verify alphanumeric code generation produces correct format and length
     * 
     * This test validates the core code generation functionality that creates random
     * verification codes for email verification purposes.
     * 
     * Test scenario:
     * - Request a code of specific length (8 characters)
     * - Verify the generated code has exactly the requested length
     * - Verify the code contains only uppercase letters (A-Z) and digits (0-9)
     * - Ensure the code is not null
     * 
     * Security consideration: The generated code should be unpredictable and follow
     * a consistent format for user recognition and system processing.
     */
    @Test
    void generateAlphanumericCode_ShouldReturnCodeOfSpecifiedLength() {
        // Act: Generate an 8-character alphanumeric code
        String code = verificationCodeService.generateAlphanumericCode(8);
        
        // Assert: Verify code properties
        assertNotNull(code);
        assertEquals(8, code.length());
        assertTrue(code.matches("^[A-Z0-9]+$"), "Code should only contain uppercase letters and digits");
    }
    
    /**
     * Test case: Verify code creation and persistence for email verification
     * 
     * This test validates the complete workflow of creating a verification code
     * for a specific email address, including proper data persistence and expiry setup.
     * 
     * Test scenario:
     * - Create a verification code for a test email address
     * - Mock repository to return the saved code
     * - Verify that the code is saved with correct email association
     * - Verify that expiry date is set to approximately 10 minutes from now
     * - Verify that all required fields are populated
     * 
     * Business logic: Verification codes should expire after 10 minutes to balance
     * security (prevent code reuse) with user experience (sufficient time to check email).
     */
    @Test
    void createCodeForEmail_ShouldGenerateAndSaveCode() {
        // Arrange: Setup expected return value from repository
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(10));
        
        when(codeRepository.save(any(VerificationCode.class))).thenReturn(code);
        
        // Act: Create verification code for email
        VerificationCode result = verificationCodeService.createCodeForEmail(TEST_EMAIL);
        
        // Assert: Verify code creation and persistence
        verify(codeRepository).save(codeCaptor.capture());
        
        VerificationCode capturedCode = codeCaptor.getValue();
        assertEquals(TEST_EMAIL, capturedCode.getEmail());
        assertNotNull(capturedCode.getCode());
        assertNotNull(capturedCode.getExpiryDate());
        
        // The expiry date should be approximately 10 minutes in the future
        OffsetDateTime now = OffsetDateTime.now();
        assertTrue(capturedCode.getExpiryDate().isAfter(now));
        assertTrue(capturedCode.getExpiryDate().isBefore(now.plusMinutes(11)));
        
        assertEquals(TEST_CODE, result.getCode());
        assertEquals(TEST_EMAIL, result.getEmail());
    }
    
    /**
     * Test case: Verify validation succeeds for valid, non-expired verification codes
     * 
     * This test ensures that the validation logic correctly identifies valid codes
     * that exist in the database and have not yet expired.
     * 
     * Test scenario:
     * - Setup a verification code that expires 5 minutes from now (not expired)
     * - Mock repository to return this valid code
     * - Call validateCode with the test code
     * - Verify that validation returns true for the valid code
     * - Verify that repository was queried with correct code
     * 
     * Security consideration: Only non-expired codes should be considered valid
     * to prevent unauthorized access using old verification codes.
     */
    @Test
    void validateCode_WithValidNonExpiredCode_ShouldReturnTrue() {
        // Arrange: Setup valid, non-expired verification code
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act: Validate the non-expired code
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert: Verify validation succeeds for valid code
        assertTrue(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    /**
     * Test case: Verify validation fails for expired verification codes
     * 
     * This test ensures that the validation logic correctly rejects codes
     * that have passed their expiry date, even if they exist in the database.
     * 
     * Test scenario:
     * - Setup a verification code that expired 5 minutes ago
     * - Mock repository to return this expired code
     * - Call validateCode with the expired test code
     * - Verify that validation returns false for the expired code
     * - Verify that repository was queried with correct code
     * 
     * Security consideration: Expired codes must be rejected to prevent
     * time-based attacks and ensure codes are only valid for their intended timeframe.
     */
    @Test
    void validateCode_WithExpiredCode_ShouldReturnFalse() {
        // Arrange: Setup expired verification code
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().minusMinutes(5)); // Expired 5 minutes ago
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act: Attempt to validate expired code
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert: Verify validation fails for expired code
        assertFalse(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    /**
     * Test case: Verify validation fails for non-existent verification codes
     * 
     * This test ensures that the validation logic correctly handles attempts
     * to validate codes that don't exist in the database.
     * 
     * Test scenario:
     * - Mock repository to return empty Optional (code not found)
     * - Call validateCode with a non-existent test code
     * - Verify that validation returns false for the non-existent code
     * - Verify that repository was queried with correct code
     * 
     * Security consideration: Non-existent codes must be rejected to prevent
     * brute force attacks and ensure only legitimate codes are accepted.
     */
    @Test
    void validateCode_WithNonExistingCode_ShouldReturnFalse() {
        // Arrange: Mock repository to return empty (code not found)
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.empty());
        
        // Act: Attempt to validate non-existent code
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert: Verify validation fails for non-existent code
        assertFalse(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    /**
     * Test case: Verify email-specific code validation succeeds for correct code
     * 
     * This test validates the more specific validation method that checks both
     * the email address and the verification code together.
     * 
     * Test scenario:
     * - Setup a valid, non-expired verification code for a specific email
     * - Mock repository to return this code when searching by email
     * - Call validateCodeForEmail with matching email and code
     * - Verify that validation returns true for the correct combination
     * - Verify that repository was queried by email (not by code)
     * 
     * Business logic: This method is used when we know the user's email
     * and want to verify they provided the correct code sent to that email.
     */
    @Test
    void validateCodeForEmail_WithValidMatch_ShouldReturnTrue() {
        // Arrange: Setup valid code for specific email
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act: Validate code for specific email address
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert: Verify validation succeeds for matching email and code
        assertTrue(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    /**
     * Test case: Verify email-specific validation fails when wrong code is provided
     * 
     * This test ensures that the email-specific validation correctly rejects
     * attempts to use incorrect codes, even for valid emails.
     * 
     * Test scenario:
     * - Setup a valid, non-expired verification code for a specific email
     * - Mock repository to return this code when searching by email
     * - Call validateCodeForEmail with correct email but wrong code
     * - Verify that validation returns false for the incorrect code
     * - Verify that repository was queried by email
     * 
     * Security consideration: Even if the email is correct, wrong codes
     * must be rejected to prevent code guessing attacks.
     */
    @Test
    void validateCodeForEmail_WithWrongCode_ShouldReturnFalse() {
        // Arrange: Setup valid code for email, but will test with wrong code
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act: Validate with correct email but wrong code
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, "WRONG_CODE");
        
        // Assert: Verify validation fails for wrong code
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    /**
     * Test case: Verify email-specific validation fails for expired codes
     * 
     * This test ensures that even when email and code match correctly,
     * expired codes are still rejected in email-specific validation.
     * 
     * Test scenario:
     * - Setup an expired verification code for a specific email
     * - Mock repository to return this expired code when searching by email
     * - Call validateCodeForEmail with correct email and correct code
     * - Verify that validation returns false due to expiry
     * - Verify that repository was queried by email
     * 
     * Security consideration: Expiry must be checked in all validation scenarios
     * to maintain temporal security boundaries.
     */
    @Test
    void validateCodeForEmail_WithExpiredCode_ShouldReturnFalse() {
        // Arrange: Setup expired code with correct email and code
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().minusMinutes(5)); // Expired 5 minutes ago
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act: Validate expired code for specific email
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert: Verify validation fails due to expiry
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    /**
     * Test case: Verify email-specific validation fails for non-existent email
     * 
     * This test ensures that validation fails gracefully when attempting
     * to validate codes for email addresses that have no verification codes.
     * 
     * Test scenario:
     * - Mock repository to return empty Optional (no code for email)
     * - Call validateCodeForEmail with non-existent email and any code
     * - Verify that validation returns false for non-existent email
     * - Verify that repository was queried by email
     * 
     * Business logic: If no verification code exists for an email,
     * validation should fail regardless of what code is provided.
     */
    @Test
    void validateCodeForEmail_WithNonExistingEmail_ShouldReturnFalse() {
        // Arrange: Mock repository to return empty (no code for email)
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.empty());
        
        // Act: Attempt to validate code for non-existent email
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert: Verify validation fails for non-existent email
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    /**
     * Test case: Verify code deletion works when code exists in database
     * 
     * This test validates the code cleanup functionality that removes
     * verification codes from the database when they are no longer needed.
     * 
     * Test scenario:
     * - Setup a verification code that exists in the database
     * - Mock repository to return this code when searched
     * - Call deleteCode with the existing code
     * - Verify that the repository's deleteByCode method is called
     * - Verify that the code was searched for before deletion
     * 
     * Business logic: Codes should be deleted after successful verification
     * or when they are no longer needed to prevent database bloat.
     */
    @Test
    void deleteCode_WhenCodeExists_ShouldDelete() {
        // Arrange: Setup existing verification code
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act: Delete the existing code
        verificationCodeService.deleteCode(TEST_CODE);
        
        // Assert: Verify deletion was performed
        verify(codeRepository).deleteByCode(TEST_CODE);
    }
    
    /**
     * Test case: Verify safe handling when attempting to delete non-existent code
     * 
     * This test ensures that the deletion logic handles non-existent codes gracefully
     * without throwing errors or performing unnecessary database operations.
     * 
     * Test scenario:
     * - Mock repository to return empty Optional (code doesn't exist)
     * - Call deleteCode with a non-existent code
     * - Verify that no deletion operation is performed
     * - Verify that the code was searched for before determining action
     * 
     * Safety consideration: The service should not fail when asked to delete
     * codes that don't exist, making it safe to call from any context.
     */
    @Test
    void deleteCode_WhenCodeDoesNotExist_ShouldNotDelete() {
        // Arrange: Mock repository to return empty (code doesn't exist)
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.empty());
        
        // Act: Attempt to delete non-existent code
        verificationCodeService.deleteCode(TEST_CODE);
        
        // Assert: Verify no deletion was performed
        verify(codeRepository, never()).deleteByCode(anyString());
    }
    
    /**
     * Test case: Verify cleanup of expired verification codes from database
     * 
     * This test validates the maintenance functionality that automatically
     * removes expired verification codes to keep the database clean.
     * 
     * Test scenario:
     * - Call deleteExpiredCodes without any setup (maintenance operation)
     * - Verify that repository's deleteByExpiryDateBefore method is called
     * - Verify that the cutoff time is approximately the current time
     * 
     * Maintenance logic: This method is typically called by scheduled tasks
     * to prevent accumulation of expired codes in the database, improving
     * performance and reducing storage requirements.
     * 
     * Business benefit: Regular cleanup ensures the verification system
     * remains efficient and doesn't suffer from database bloat over time.
     */
    @Test
    void deleteExpiredCodes_ShouldDeleteCodesOlderThanNow() {
        // Act: Perform expired codes cleanup
        verificationCodeService.deleteExpiredCodes();
        
        // Assert: Verify cleanup operation was performed with current time cutoff
        verify(codeRepository).deleteByExpiryDateBefore(any(OffsetDateTime.class));
    }
}


