package com.amarvote.amarvote.util;

import java.util.Base64;
import java.util.Date;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

/**
 * Standalone probe — prints a JWT exactly as JWTService.generateJWTToken() would.
 * Run: JWT_SECRET=... mvn -q -DskipTests exec:java -Dexec.mainClass=com.amarvote.amarvote.util.JwtTokenProbe
 */
public final class JwtTokenProbe {

    private JwtTokenProbe() {
    }

    public static void main(String[] args) {
        String secretKey = System.getenv().getOrDefault(
                "JWT_SECRET",
                "X2Y5ZTg3N2QnZUVzN9YxNTokNGU35jQ0YUlsZTAkMmC=");
        String email = System.getenv().getOrDefault(
                "TEST_EMAIL",
                "loadtest-voter-0001@yourdomain.com");
        long expirationMillis = Long.parseLong(System.getenv().getOrDefault("JWT_EXPIRATION_MS", "3600000"));

        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        SecretKey key = Keys.hmacShaKeyFor(keyBytes);

        String token = Jwts.builder()
                .subject(email)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expirationMillis))
                .signWith(key)
                .compact();

        String[] parts = token.split("\\.");
        System.out.println("TOKEN=" + token);
        System.out.println("HEADER=" + new String(Base64.getUrlDecoder().decode(parts[0])));
        System.out.println("PAYLOAD=" + new String(Base64.getUrlDecoder().decode(parts[1])));
    }
}
