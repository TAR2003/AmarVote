package com.amarvote.amarvote.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendSignupVerificationEmail(String toEmail, String token) {
        String subject = "Signup Email Verification Code";
        String message = "Welcome! Your signup verification code is: " + token + "\n\nThis code will expire in 10 minutes.";

        sendEmail(toEmail, subject, message);
    }

    public void sendForgotPasswordEmail(String toEmail, String resetLink) {
        String subject = "Password Reset Link";
        String message = "You requested a password reset. Click the link below to reset your password:\n"
                + resetLink + "\n\nThis link will expire in 10 minutes.";

        sendEmail(toEmail, subject, message);
    }

    private void sendEmail(String toEmail, String subject, String message) {
        SimpleMailMessage email = new SimpleMailMessage();
        email.setTo(toEmail);
        email.setSubject(subject);
        email.setText(message);
        email.setFrom("your_email@gmail.com");

        mailSender.send(email);
    }
}

// package com.amarvote.amarvote.service;
// import java.util.Collections;
// import org.springframework.beans.factory.annotation.Value;
// import org.springframework.stereotype.Service;
// import brevo.ApiClient;
// import brevo.ApiException;
// import brevo.Configuration;
// import brevoApi.TransactionalEmailsApi;
// import brevoModel.SendSmtpEmail;
// import brevoModel.SendSmtpEmailSender;
// import brevoModel.SendSmtpEmailTo;
// import jakarta.annotation.PostConstruct;
// @Service
// public class EmailService {
//     @Value("${brevo.api.key}")
//     private String apiKey;
//     @Value("${brevo.sender.email}")
//     private String senderEmail;
//     @Value("${brevo.sender.name}")
//     private String senderName;
//     private TransactionalEmailsApi emailApi;
//     @PostConstruct
//     public void init() {
//         ApiClient client = Configuration.getDefaultApiClient();
//         client.setApiKey(apiKey);
//         this.emailApi = new TransactionalEmailsApi(client);
//     }
//     public void sendVerificationEmail(String toEmail, String code) {
//         SendSmtpEmail smtpEmail = new SendSmtpEmail()
//                 .sender(new SendSmtpEmailSender().email(senderEmail).name(senderName))
//                 .to(Collections.singletonList(new SendSmtpEmailTo().email(toEmail)))
//                 .subject("Verify Your Account")
//                 .htmlContent("<p>Your verification code is: <strong>" + code + "</strong></p><p>This code will expire in 10 minutes.</p>");
//         try {
//             emailApi.sendTransacEmail(smtpEmail);
//             System.out.println("Verification email sent to " + toEmail);
//         } catch (ApiException e) {
//             throw new RuntimeException("Failed to send email: " + e.getResponseBody(), e);
//         }
//     }
// }
