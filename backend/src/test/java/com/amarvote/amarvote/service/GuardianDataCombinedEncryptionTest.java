package com.amarvote.amarvote.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class to demonstrate the new combined encryption/decryption functionality
 * for guardian private keys and polynomials.
 */
@SpringBootTest
@SpringJUnitConfig
public class GuardianDataCombinedEncryptionTest {

    @Test
    public void testCombinedStringCreationAndParsing() {
        // Sample guardian data
        String privateKey = "12345abcdef";
        String polynomial = "987654321xyz";
        
        // Expected combined format
        String expectedCombined = "===Private Key===\n" + privateKey + "\n===Polynomial===\n" + polynomial;
        
        System.out.println("Expected Combined Format:");
        System.out.println(expectedCombined);
        
        // This test demonstrates the format that will be encrypted and decrypted
        // The actual encryption/decryption happens in ElectionGuardCryptoService
        
        // Simulate parsing the combined string
        String[] parts = expectedCombined.split("===Private Key===|===Polynomial===");
        
        assertEquals(3, parts.length, "Combined string should have 3 parts after splitting");
        
        String extractedPrivateKey = parts[1].trim();
        String extractedPolynomial = parts[2].trim();
        
        assertEquals(privateKey, extractedPrivateKey, "Extracted private key should match original");
        assertEquals(polynomial, extractedPolynomial, "Extracted polynomial should match original");
        
        System.out.println("✅ Combined string format test passed!");
    }
    
    @Test
    public void testCombinedStringWithMultilineData() {
        // Test with more realistic multi-line data
        String privateKey = "{\n  \"key\": \"value\",\n  \"data\": \"12345\"\n}";
        String polynomial = "{\n  \"coefficients\": [1, 2, 3],\n  \"degree\": 2\n}";
        
        String combined = "===Private Key===\n" + privateKey + "\n===Polynomial===\n" + polynomial;
        
        System.out.println("Combined format with multiline data:");
        System.out.println(combined);
        
        // Parse it back
        String[] parts = combined.split("===Private Key===|===Polynomial===");
        String extractedPrivateKey = parts[1].trim();
        String extractedPolynomial = parts[2].trim();
        
        assertEquals(privateKey, extractedPrivateKey, "Extracted private key should match original multiline data");
        assertEquals(polynomial, extractedPolynomial, "Extracted polynomial should match original multiline data");
        
        System.out.println("✅ Multiline data test passed!");
    }
}
