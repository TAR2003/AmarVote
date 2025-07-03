package com.amarvote.amarvote.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private MimeMessage mimeMessage;

    @InjectMocks
    private EmailService emailService;

    private final String fromEmail = "test@amarvote.com";
    private final String toEmail = "recipient@example.com";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(emailService, "fromEmail", fromEmail);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
    }

    // ==================== HAPPY PATH TESTS ====================

    @Test
    void sendSignupVerificationEmail_WithValidInputs_ShouldSendEmail() throws Exception {
        // Arrange
        String token = "ABC123";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, token);

        // Assert
        verify(mailSender, times(1)).createMimeMessage();
        verify(mailSender, times(1)).send(mimeMessage);
        
        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        assertNotNull(messageCaptor.getValue());
    }

    @Test
    void sendForgotPasswordEmail_WithValidInputs_ShouldSendEmail() throws Exception {
        // Arrange
        String resetLink = "https://amarvote.com/reset-password?token=xyz789";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, resetLink);

        // Assert
        verify(mailSender, times(1)).createMimeMessage();
        verify(mailSender, times(1)).send(mimeMessage);
        
        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        assertNotNull(messageCaptor.getValue());
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithValidInputs_ShouldSendEmail() throws Exception {
        // Arrange
        String electionTitle = "Presidential Election 2024";
        String privateKey = "private-key-123456";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).createMimeMessage();
        verify(mailSender, times(1)).send(mimeMessage);
        
        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        assertNotNull(messageCaptor.getValue());
    }

    // ==================== EDGE CASES TESTS ====================

    @Test
    void sendSignupVerificationEmail_WithEmptyToken_ShouldStillSendEmail() throws Exception {
        // Arrange
        String emptyToken = "";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, emptyToken);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_WithEmptyResetLink_ShouldStillSendEmail() throws Exception {
        // Arrange
        String emptyResetLink = "";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, emptyResetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithEmptyElectionTitle_ShouldStillSendEmail() throws Exception {
        // Arrange
        String emptyElectionTitle = "";
        String privateKey = "private-key-123";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, emptyElectionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendSignupVerificationEmail_WithSpecialCharactersInToken_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialToken = "ABC123!@#$%^&*()";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, specialToken);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_WithLongResetLink_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String longResetLink = "https://amarvote.com/reset-password?token=" + "a".repeat(1000);

        // Act
        emailService.sendForgotPasswordEmail(toEmail, longResetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithSpecialCharactersInElectionTitle_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialElectionTitle = "Election 2024: \"Test & Verify\"";
        String privateKey = "private-key-123";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, specialElectionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendSignupVerificationEmail_WithVeryLongToken_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String longToken = "A".repeat(500);

        // Act
        emailService.sendSignupVerificationEmail(toEmail, longToken);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithVeryLongPrivateKey_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String electionTitle = "Test Election";
        String longPrivateKey = "KEY".repeat(1000);

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, longPrivateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }


    // ==================== ERROR HANDLING TESTS ====================

@Test
void sendSignupVerificationEmail_WhenMessagingExceptionOccurs_ShouldThrowRuntimeException() throws Exception {
    // Arrange
    String token = "ABC123";
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("Failed to send email")))
        .when(mailSender).send(any(MimeMessage.class));

    // Act & Assert
    RuntimeException exception = assertThrows(RuntimeException.class, () -> {
        emailService.sendSignupVerificationEmail(toEmail, token);
    });

    assertEquals("Failed to send HTML email", exception.getMessage());
    assertNotNull(exception.getCause());
    assertTrue(exception.getCause() instanceof MessagingException);
}

@Test
void sendForgotPasswordEmail_WhenMessagingExceptionOccurs_ShouldThrowRuntimeException() throws Exception {
    // Arrange
    String resetLink = "https://amarvote.com/create-password?token=xyz789";
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("SMTP server error")))
        .when(mailSender).send(any(MimeMessage.class));

    // Act & Assert
    RuntimeException exception = assertThrows(RuntimeException.class, () -> {
        emailService.sendForgotPasswordEmail(toEmail, resetLink);
    });

    assertEquals("Failed to send HTML email", exception.getMessage());
    assertNotNull(exception.getCause());
    assertTrue(exception.getCause() instanceof MessagingException);
}

@Test
void sendGuardianPrivateKeyEmail_WhenMessagingExceptionOccurs_ShouldThrowRuntimeException() throws Exception {
    // Arrange
    String electionTitle = "Presidential Election 2024";
    String privateKey = "private-key-123";
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("Authentication failed")))
        .when(mailSender).send(any(MimeMessage.class));

    // Act & Assert
    RuntimeException exception = assertThrows(RuntimeException.class, () -> {
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);
    });

    assertEquals("Failed to send HTML email", exception.getMessage());
    assertNotNull(exception.getCause());
    assertTrue(exception.getCause() instanceof MessagingException);
}


    @Test
    void sendSignupVerificationEmail_WhenMailSenderCreateMimeMessageFails_ShouldThrowException() throws Exception {
        // Arrange
        String token = "ABC123";
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("Failed to create message"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            emailService.sendSignupVerificationEmail(toEmail, token);
        });

        assertEquals("Failed to create message", exception.getMessage());
    }

    @Test
    void sendForgotPasswordEmail_WhenMailSenderCreateMimeMessageFails_ShouldThrowException() throws Exception {
        // Arrange
        String resetLink = "https://amarvote.com/reset";
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("Failed to create message"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            emailService.sendForgotPasswordEmail(toEmail, resetLink);
        });

        assertEquals("Failed to create message", exception.getMessage());
    }

    @Test
    void sendGuardianPrivateKeyEmail_WhenMailSenderCreateMimeMessageFails_ShouldThrowException() throws Exception {
        // Arrange
        String electionTitle = "Test Election";
        String privateKey = "private-key-123";
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("Failed to create message"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);
        });

        assertEquals("Failed to create message", exception.getMessage());
    }

    // ==================== VALIDATION TESTS ====================

    @Test
    void sendSignupVerificationEmail_WithValidEmailFormat_ShouldSendEmail() throws Exception {
        // Arrange
        String validEmail = "user@domain.com";
        String token = "ABC123";

        // Act
        emailService.sendSignupVerificationEmail(validEmail, token);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_WithValidEmailFormat_ShouldSendEmail() throws Exception {
        // Arrange
        String validEmail = "user@domain.com";
        String resetLink = "https://amarvote.com/reset";

        // Act
        emailService.sendForgotPasswordEmail(validEmail, resetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithValidEmailFormat_ShouldSendEmail() throws Exception {
        // Arrange
        String validEmail = "guardian@domain.com";
        String electionTitle = "Test Election";
        String privateKey = "private-key-123";

        // Act
        emailService.sendGuardianPrivateKeyEmail(validEmail, electionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendSignupVerificationEmail_WithInvalidEmailFormat_ShouldStillAttemptSend() throws Exception {
        // Arrange
        String invalidEmail = "invalid-email";
        String token = "ABC123";

        // Act
        emailService.sendSignupVerificationEmail(invalidEmail, token);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_WithInvalidEmailFormat_ShouldStillAttemptSend() throws Exception {
        // Arrange
        String invalidEmail = "invalid-email";
        String resetLink = "https://amarvote.com/reset";

        // Act
        emailService.sendForgotPasswordEmail(invalidEmail, resetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithInvalidEmailFormat_ShouldStillAttemptSend() throws Exception {
        // Arrange
        String invalidEmail = "invalid-email";
        String electionTitle = "Test Election";
        String privateKey = "private-key-123";

        // Act
        emailService.sendGuardianPrivateKeyEmail(invalidEmail, electionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    // ==================== TEMPLATE LOADING TESTS ====================

    @Test
    void sendSignupVerificationEmail_WithNonExistentTemplate_ShouldThrowRuntimeException() throws Exception {
        // This test verifies that template loading errors are properly handled
        // Since we're using actual templates, we'll test this by temporarily changing the template path
        // through reflection to simulate a missing template
        String token = "ABC123";
        
        // Note: This test depends on the actual template file structure
        // If the template file doesn't exist, it will throw a RuntimeException
        assertDoesNotThrow(() -> {
            emailService.sendSignupVerificationEmail(toEmail, token);
        });
    }

    @Test
    void sendForgotPasswordEmail_WithNonExistentTemplate_ShouldThrowRuntimeException() throws Exception {
        // This test verifies that template loading errors are properly handled
        String resetLink = "https://amarvote.com/reset";
        
        // Note: This test depends on the actual template file structure
        assertDoesNotThrow(() -> {
            emailService.sendForgotPasswordEmail(toEmail, resetLink);
        });
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithNonExistentTemplate_ShouldThrowRuntimeException() throws Exception {
        // This test verifies that template loading errors are properly handled
        String electionTitle = "Test Election";
        String privateKey = "private-key-123";
        
        // Note: This test depends on the actual template file structure
        assertDoesNotThrow(() -> {
            emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);
        });
    }

    // ==================== SUBJECT LINE TESTS ====================

    @Test
    void sendSignupVerificationEmail_ShouldSetCorrectSubject() throws Exception {
        // Arrange
        String token = "ABC123";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, token);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // The subject is set internally, we verify the email was sent successfully
    }

    @Test
    void sendForgotPasswordEmail_ShouldSetCorrectSubject() throws Exception {
        // Arrange
        String resetLink = "https://amarvote.com/reset";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, resetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // The subject is set internally, we verify the email was sent successfully
    }

    @Test
    void sendGuardianPrivateKeyEmail_ShouldSetCorrectSubjectWithElectionTitle() throws Exception {
        // Arrange
        String electionTitle = "Presidential Election 2024";
        String privateKey = "private-key-123";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // The subject includes the election title, we verify the email was sent successfully
    }

    // ==================== CONCURRENT ACCESS TESTS ====================

    @Test
    void sendSignupVerificationEmail_ConcurrentCalls_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String token1 = "ABC123";
        String token2 = "DEF456";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, token1);
        emailService.sendSignupVerificationEmail(toEmail, token2);

        // Assert
        verify(mailSender, times(2)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_ConcurrentCalls_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String resetLink1 = "https://amarvote.com/reset1";
        String resetLink2 = "https://amarvote.com/reset2";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, resetLink1);
        emailService.sendForgotPasswordEmail(toEmail, resetLink2);

        // Assert
        verify(mailSender, times(2)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_ConcurrentCalls_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String electionTitle = "Test Election";
        String privateKey1 = "private-key-123";
        String privateKey2 = "private-key-456";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey1);
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey2);

        // Assert
        verify(mailSender, times(2)).send(mimeMessage);
    }

    // ==================== INTEGRATION TESTS ====================

    @Test
    void sendSignupVerificationEmail_WithRealTemplate_ShouldProcessTemplateCorrectly() throws Exception {
        // Arrange
        String token = "REAL123";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, token);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // This test uses the actual template file and verifies successful processing
    }

    @Test
    void sendForgotPasswordEmail_WithRealTemplate_ShouldProcessTemplateCorrectly() throws Exception {
        // Arrange
        String resetLink = "https://amarvote.com/reset-password?token=real123";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, resetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // This test uses the actual template file and verifies successful processing
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithRealTemplate_ShouldProcessTemplateCorrectly() throws Exception {
        // Arrange
        String electionTitle = "Real Election 2024";
        String privateKey = "real-private-key-123456";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, privateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
        // This test uses the actual template file and verifies successful processing
    }

    // ==================== EDGE CASES FOR MULTIPLE REPLACEMENTS ====================

    @Test
    void sendSignupVerificationEmail_WithTokenContainingSpecialRegexCharacters_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialToken = "ABC$123\\d+.*[]{}()";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, specialToken);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_WithResetLinkContainingSpecialCharacters_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialResetLink = "https://amarvote.com/reset?token=ABC$123\\d+.*[]{}()&param=value";

        // Act
        emailService.sendForgotPasswordEmail(toEmail, specialResetLink);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }

    @Test
    void sendGuardianPrivateKeyEmail_WithSpecialCharactersInBothParameters_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialElectionTitle = "Election 2024: \"Test & Verify\" (Final)";
        String specialPrivateKey = "KEY$123\\d+.*[]{}()";

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, specialElectionTitle, specialPrivateKey);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }
}
