package com.amarvote.amarvote.service;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.config.FirebaseAdminConfig;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;

@Service
public class FirebaseAuthService {

    @Autowired
    private JWTService jwtService;

    @Autowired
    private FirebaseAdminConfig firebaseAdminConfig;

    @Value("${jwt.expiration}")
    private long jwtExpirationMillis;

    public Optional<String> verifyFirebaseIdTokenAndCreateSessionJwt(String firebaseIdToken) {
        if (!firebaseAdminConfig.ensureInitialized()) {
            return Optional.empty();
        }

        try {
            FirebaseToken verifiedToken = FirebaseAuth.getInstance().verifyIdToken(firebaseIdToken);
            String email = verifiedToken.getEmail();

            if (email == null || email.isBlank()) {
                return Optional.empty();
            }

            String amarVoteJwt = jwtService.generateJWTToken(email, jwtExpirationMillis);
            return Optional.of(amarVoteJwt);
        } catch (FirebaseAuthException e) {
            return Optional.empty();
        }
    }
}
