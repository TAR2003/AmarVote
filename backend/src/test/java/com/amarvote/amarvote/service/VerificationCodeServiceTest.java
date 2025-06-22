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
    
    @Test
    void generateAlphanumericCode_ShouldReturnCodeOfSpecifiedLength() {
        // Act
        String code = verificationCodeService.generateAlphanumericCode(8);
        
        // Assert
        assertNotNull(code);
        assertEquals(8, code.length());
        assertTrue(code.matches("^[A-Z0-9]+$"), "Code should only contain uppercase letters and digits");
    }
    
    @Test
    void createCodeForEmail_ShouldGenerateAndSaveCode() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(10));
        
        when(codeRepository.save(any(VerificationCode.class))).thenReturn(code);
        
        // Act
        VerificationCode result = verificationCodeService.createCodeForEmail(TEST_EMAIL);
        
        // Assert
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
    
    @Test
    void validateCode_WithValidNonExpiredCode_ShouldReturnTrue() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert
        assertTrue(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    @Test
    void validateCode_WithExpiredCode_ShouldReturnFalse() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().minusMinutes(5)); // Expired
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert
        assertFalse(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    @Test
    void validateCode_WithNonExistingCode_ShouldReturnFalse() {
        // Arrange
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.empty());
        
        // Act
        boolean isValid = verificationCodeService.validateCode(TEST_CODE);
        
        // Assert
        assertFalse(isValid);
        verify(codeRepository).findByCode(TEST_CODE);
    }
    
    @Test
    void validateCodeForEmail_WithValidMatch_ShouldReturnTrue() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert
        assertTrue(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    @Test
    void validateCodeForEmail_WithWrongCode_ShouldReturnFalse() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(5)); // Not expired
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, "WRONG_CODE");
        
        // Assert
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    @Test
    void validateCodeForEmail_WithExpiredCode_ShouldReturnFalse() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        code.setEmail(TEST_EMAIL);
        code.setExpiryDate(OffsetDateTime.now().minusMinutes(5)); // Expired
        
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(code));
        
        // Act
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    @Test
    void validateCodeForEmail_WithNonExistingEmail_ShouldReturnFalse() {
        // Arrange
        when(codeRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.empty());
        
        // Act
        boolean isValid = verificationCodeService.validateCodeForEmail(TEST_EMAIL, TEST_CODE);
        
        // Assert
        assertFalse(isValid);
        verify(codeRepository).findByEmail(TEST_EMAIL);
    }
    
    @Test
    void deleteCode_WhenCodeExists_ShouldDelete() {
        // Arrange
        VerificationCode code = new VerificationCode();
        code.setCode(TEST_CODE);
        
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.of(code));
        
        // Act
        verificationCodeService.deleteCode(TEST_CODE);
        
        // Assert
        verify(codeRepository).deleteByCode(TEST_CODE);
    }
    
    @Test
    void deleteCode_WhenCodeDoesNotExist_ShouldNotDelete() {
        // Arrange
        when(codeRepository.findByCode(TEST_CODE)).thenReturn(Optional.empty());
        
        // Act
        verificationCodeService.deleteCode(TEST_CODE);
        
        // Assert
        verify(codeRepository, never()).deleteByCode(anyString());
    }
    
    @Test
    void deleteExpiredCodes_ShouldDeleteCodesOlderThanNow() {
        // Act
        verificationCodeService.deleteExpiredCodes();
        
        // Assert
        verify(codeRepository).deleteByExpiryDateBefore(any(OffsetDateTime.class));
    }
}
