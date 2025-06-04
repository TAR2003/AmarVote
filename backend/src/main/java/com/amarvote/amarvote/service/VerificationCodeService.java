package com.amarvote.amarvote.service;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.VerificationCode;
import com.amarvote.amarvote.repository.VerificationCodeRepository;

@Service
public class VerificationCodeService {

    @Autowired
    private VerificationCodeRepository codeRepository;

    // Generate code, save with expiry 10 mins from now
    public VerificationCode createCodeForEmail(String email) {
        VerificationCode code = new VerificationCode();
        code.setCode(UUID.randomUUID().toString());
        code.setEmail(email);
        code.setExpiryDate(OffsetDateTime.now().plusMinutes(10));
        return codeRepository.save(code);
    }

    // Validate code: check if code exists and is not expired
    public boolean validateCode(String code) {
        Optional<VerificationCode> opt = codeRepository.findByCode(code);
        if (opt.isEmpty()) return false;

        VerificationCode verificationCode = opt.get();
        return verificationCode.getExpiryDate().isAfter(OffsetDateTime.now());
    }

    //delete the verification code after succesfully signing up
    @Transactional
    public void deleteCode(String code) {
        Optional<VerificationCode> opt = codeRepository.findByCode(code);
        if (opt.isPresent()) {
            codeRepository.deleteByCode(code);
        }
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
