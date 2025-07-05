package com.amarvote.amarvote.service;

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
        String token = "ABCD1234";

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
        String resetLink = "https://amarvote.com/create-password?token=xyz789";

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
        String electionDescription = "A democratic election to choose our next president";
        String privateKey = "private-key-123456";
        Long electionId = 1L;

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, electionDescription, privateKey, electionId);

        // Assert
        verify(mailSender, times(1)).createMimeMessage();
        verify(mailSender, times(1)).send(mimeMessage);
        
        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(messageCaptor.capture());
        assertNotNull(messageCaptor.getValue());
    }

    // ==================== EDGE CASES TESTS ====================

    @Test
    void sendGuardianPrivateKeyEmail_WithSpecialCharactersInElectionTitle_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String specialElectionTitle = "Election 2024: \"Test & Verify\"";
        String electionDescription = "Special test election";
        String privateKey = "private-key-123";
        Long electionId = 2L;

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, specialElectionTitle, electionDescription, privateKey, electionId);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }


    // ==================== ERROR HANDLING TESTS ====================

@Test
void sendSignupVerificationEmail_WhenMessagingExceptionOccurs_ShouldThrowRuntimeException() throws Exception {
    // Arrange
    String token = "ABCD1234";
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("Failed to send HTML email")))
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
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("Failed to send HTML email")))
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
    String electionDescription = "A democratic election to choose our next president";
    String privateKey = "private-key-123";
    Long electionId = 1L;
    doThrow(new RuntimeException("Failed to send HTML email", new MessagingException("Failed to send HTML email")))
        .when(mailSender).send(any(MimeMessage.class));

    // Act & Assert
    RuntimeException exception = assertThrows(RuntimeException.class, () -> {
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, electionDescription, privateKey, electionId);
    });

    assertEquals("Failed to send HTML email", exception.getMessage());
    assertNotNull(exception.getCause());
    assertTrue(exception.getCause() instanceof MessagingException);
}



    @Test
    void sendSignupVerificationEmail_WhenMailSenderCreateMimeMessageFails_ShouldThrowException() throws Exception {
        // Arrange
        String token = "ABCD1234";
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
        String resetLink = "https://amarvote.com/create-password?token=xyz789";
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
        String electionDescription = "A test election";
        String privateKey = "private-key-123";
        Long electionId = 3L;
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("Failed to create message"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, electionDescription, privateKey, electionId);
        });

        assertEquals("Failed to create message", exception.getMessage());
    }

    // ==================== CONCURRENT ACCESS TESTS ====================

    @Test
    void sendSignupVerificationEmail_ConcurrentCalls_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String token1 = "ABCD1234";
        String token2 = "DEFG4567";

        // Act
        emailService.sendSignupVerificationEmail(toEmail, token1);
        emailService.sendSignupVerificationEmail(toEmail, token2);

        // Assert
        verify(mailSender, times(2)).send(mimeMessage);
    }

    @Test
    void sendForgotPasswordEmail_ConcurrentCalls_ShouldHandleCorrectly() throws Exception {
        // Arrange
        String resetLink1 = "https://amarvote.com/create-password?token=xyz789";
        String resetLink2 = "https://amarvote.com/create-password?token=abc123";

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
        String electionDescription = "Test election description";
        String privateKey1 = "private-key-123";
        String privateKey2 = "private-key-456";
        Long electionId = 4L;

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, electionDescription, privateKey1, electionId);
        emailService.sendGuardianPrivateKeyEmail(toEmail, electionTitle, electionDescription, privateKey2, electionId);

        // Assert
        verify(mailSender, times(2)).send(mimeMessage);
    }


    // ==================== EDGE CASES FOR MULTIPLE REPLACEMENTS ====================

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
        String specialElectionDescription = "Special test & verification election";
        String specialPrivateKey = "KEY$123\\d+.*[]{}()";
        Long electionId = 5L;

        // Act
        emailService.sendGuardianPrivateKeyEmail(toEmail, specialElectionTitle, specialElectionDescription, specialPrivateKey, electionId);

        // Assert
        verify(mailSender, times(1)).send(mimeMessage);
    }
}