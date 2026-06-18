package com.amarvote.amarvote.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

class JWTServiceLoadTestCompatibilityTest {

    private static final String SECRET_B64 = "X2Y5ZTg3N2QnZUVzN9YxNTokNGU35jQ0YUlsZTAkMmC=";
    private static final String EMAIL = "loadtest-voter-0001@yourdomain.com";

    private JWTService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JWTService();
        ReflectionTestUtils.setField(jwtService, "secretKey", SECRET_B64);
        ReflectionTestUtils.setField(jwtService, "expirationMillis", 3_600_000L);
    }

    @Test
    void loadTestStyleTokenIsAcceptedByJwtService() throws Exception {
        String manualToken = buildLoadTestStyleToken(SECRET_B64, EMAIL, 3_600);
        assertEquals(EMAIL, jwtService.extractUserEmailFromToken(manualToken));
        assertFalse(jwtService.isTokenExpired(manualToken));
    }

    @Test
    void jwtServiceTokenCanBeParsedWithSameKeyMaterial() {
        String backendToken = jwtService.generateJWTToken(EMAIL);
        assertEquals(EMAIL, jwtService.extractUserEmailFromToken(backendToken));
    }

    private static String buildLoadTestStyleToken(String secretB64, String email, long ttlSeconds) throws Exception {
        long now = System.currentTimeMillis() / 1000;
        String header = base64Url("{\"alg\":\"HS256\"}".getBytes(StandardCharsets.UTF_8));
        String payload = base64Url(String.format(
                "{\"sub\":\"%s\",\"iat\":%d,\"exp\":%d}", email, now, now + ttlSeconds)
                .getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + payload;

        byte[] keyBytes = Decoders.BASE64.decode(secretB64);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(keyBytes, "HmacSHA256"));
        String signature = base64Url(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
        return signingInput + "." + signature;
    }

    private static String base64Url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }
}
