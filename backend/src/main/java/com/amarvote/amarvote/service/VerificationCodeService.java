package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.VerificationCode;
import com.amarvote.amarvote.repository.VerificationCodeRepository;

@Service
public class VerificationCodeService {

    @Autowired
    private VerificationCodeRepository codeRepository;

    public String generateAlphanumericCode(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    // Generate code, save with expiry 10 mins from now
    public VerificationCode createCodeForEmail(String email) {
        VerificationCode code = new VerificationCode();
        code.setCode(generateAlphanumericCode(8)); // 
        code.setEmail(email);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(10));
        return codeRepository.save(code);
    }

    // Validate code: check if code exists and is not expired
    public boolean validateCode(String code) {
        Optional<VerificationCode> opt = codeRepository.findByCode(code);
        if (opt.isEmpty()) {
            return false;
        }

        VerificationCode verificationCode = opt.get();
        return verificationCode.getExpiryDate().isAfter(OffsetDateTime.now());
    }

    public boolean validateCodeForEmail(String email, String code) {
        Optional<VerificationCode> opt = codeRepository.findByEmail(email);
        return opt.filter(vc -> vc.getCode().equals(code) && vc.getExpiryDate().isAfter(OffsetDateTime.now()))
                .isPresent();
    }

    //delete the verification code after succesfully signing up
    @Transactional
    public void deleteCode(String code) {
        Optional<VerificationCode> opt = codeRepository.findByCode(code);
        if (opt.isPresent()) {
            codeRepository.deleteByCode(code);
        }
    }

    //delete all verification codes for a specific email
    @Transactional
    public void deleteCodesByEmail(String email) {
        codeRepository.deleteByEmail(email);
    }

    @Transactional
    public void deleteExpiredCodes() {
        OffsetDateTime now = OffsetDateTime.now();
        codeRepository.deleteByExpiryDateBefore(now);
    }

    // // Optionally: delete expired tokens periodically
    // public void deleteExpiredTokens() {
    //    codeRepository.deleteByExpiryDateBefore(OffsetDateTime.now());
    // }
}

