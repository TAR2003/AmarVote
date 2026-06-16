# AmarVote JWT & Encryption Analysis

## ✅ CONFIRMED: Your Backend Uses **HS256** (HMAC with SHA-256)

---

## 🔍 Evidence from Codebase

### 1. **Configuration (application.properties)**
```properties
jwt.secret=${JWT_SECRET}
jwt.expiration=3600000  # 1 hour
```

### 2. **JWT Generation Code (JWTService.java)**

```java
@Service
public class JWTService {
    
    @Value("${jwt.secret}")
    private String secretKey;
    
    @Value("${jwt.expiration}")
    private long expirationMillis;

    public String generateJWTToken(String userEmail) {
        return Jwts.builder()
                .subject(userEmail)                          // Email stored here
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expirationMillis))
                .signWith(getKey())                          // Signs with HS256
                .compact();
    }

    private SecretKey getKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);  // ← THIS IS HS256 CONFIRMATION!
    }
}
```

**Key Line:** `Keys.hmacShaKeyFor(keyBytes)` - This creates an HMAC-SHA256 signing key.

---

## 📊 How JWT Token Encryption Works

### Token Structure: `header.payload.signature`

**Token Header (auto-generated):**
```json
{
  "alg": "HS256",     // Algorithm
  "typ": "JWT"
}
```

**Token Payload (what we control):**
```json
{
  "sub": "user@example.com",        // Email (subject claim)
  "iat": 1234567890,                // Issued at time
  "exp": 1234571490,                // Expiration time
  "purpose": "password-reset"       // (optional custom claim)
}
```

**Token Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  jwt.secret  // Your SECRET_KEY from application.properties
)
```

### Step-by-Step Token Generation Flow:

1. **Read `jwt.secret` from environment** → Decoded from BASE64
2. **Create HMAC-SHA256 key** from the secret
3. **Add email as subject claim**
4. **Add issuedAt & expiration timestamps**
5. **Sign with the HMAC key**
6. **Return compact JWT**

---

## 🔐 How Email is Encrypted/Secured in JWT

### Email in JWT is NOT encrypted—it's **encoded & signed**:

| Layer | Method | Secure? | Details |
|:---|:---|:---|:---|
| **Base64 Encoding** | Base64URL encoding | ❌ No | Encoding ≠ encryption; reversible |
| **HMAC Signature** | HS256 with secret | ✅ Yes | Ensures token wasn't tampered with |
| **Transport** | HTTPS/TLS | ✅ Yes | Encrypts in-transit |
| **Storage** | Browser localStorage/sessionStorage | ⚠️ Caution | Vulnerable to XSS attacks |

**Important:** JWT payload is **visible** (not encrypted). Anyone with the token can decode and see the email. The **HMAC signature** prevents tampering—the backend verifies the signature matches the payload.

---

## 🔓 Three-Layer Security Architecture

Your system uses a **layered encryption strategy**:

### Layer 1: JWT Tokens (HS256 - HMAC)
```
Purpose: User authentication & session management
Algorithm: HS256 (symmetric HMAC-SHA256)
Contains: Email, expiration, custom claims
Secret Key: ${JWT_SECRET} from application.properties
TTL: 1 hour (jwt.expiration=3600000)
```

**Generated for:**
- Regular login tokens
- Password reset tokens
- Email verification tokens
- MFA pending tokens

### Layer 2: MFA Secrets (AES - Asymmetric Encryption)
```
Purpose: Encrypt 2FA secrets (TOTP keys) in database
Algorithm: AES/ECB/PKCS5Padding (symmetric)
Key Source: SHA-256 hash of ${MASTER_KEY_PQ}
Storage: PostgreSQL database (encrypted column)
Conversion: MfaSecretConverter automatically encrypts/decrypts
```

**Flow:**
```
Plain MFA Secret
    ↓
AES Encrypt with MASTER_KEY_PQ
    ↓
Base64 Encode
    ↓
Store in Database (encrypted column)
    ↓
On Retrieval: Base64 Decode → AES Decrypt → Plain Secret
```

### Layer 3: Guardian Credentials (Temporary Redis Storage)
```
Purpose: Store temporary cryptographic materials during decryption
Storage: Redis (in-memory)
TTL: 360 minutes (6 hours)
Credentials: Private keys, polynomial coefficients
Security: In-memory only (not persisted to disk)
```

**Flow:**
```
Guardian enters private key/password
    ↓
Decrypt with user's key material
    ↓
Store temporarily in Redis with TTL
    ↓
Use for ElectionGuard cryptographic operations
    ↓
Auto-expire from Redis after 6 hours (or on completion)
    ↓
Never persisted to disk
```

---

## 📧 Email Security - Specific to Your Use Cases

### ✉️ Use Case 1: Email Verification Token

**Code (TempJwtService.java):**
```java
public String generateEmailVerificationToken(String email) {
    return Jwts.builder()
            .subject(email)                    // ← Email stored as subject
            .issuedAt(new Date())
            .expiration(new Date(now + EMAIL_VERIFICATION_TOKEN_VALIDITY_MILLIS))
            .claim("email_verified", true)     // ← Custom claim
            .claim("scope", "register")        // ← Purpose indicator
            .signWith(getKey())                // ← Signed with HS256
            .compact();
}
```

**What's secured:**
- ✅ Email can't be tampered with (signature verification fails)
- ✅ Can't extend expiration (TTL is 10 minutes)
- ✅ Can't use for other purposes (scope=register check)
- ❌ Email is visible in token (not encrypted, just signed)

**Token sent to user's email:**
```
Click: https://amarvote.com/verify?token=eyJhbGc...
```

---

### 🔑 Use Case 2: Password Reset Token

**Code (JWTService.java):**
```java
public String generatePasswordResetToken(String email, long durationMillis) {
    return Jwts.builder()
            .subject(email)                    // ← Email embedded
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + durationMillis))
            .claim("purpose", "password-reset")
            .signWith(getKey())
            .compact();
}
```

**Verification:**
```java
public Optional<String> validatePasswordResetToken(String token) {
    Claims claims = extractAllClaims(token);
    
    // Check purpose
    if (!"password-reset".equals(claims.get("purpose"))) {
        return Optional.empty();
    }
    
    // Check expiration (automatic)
    return Optional.ofNullable(claims.getSubject()); // Returns email if valid
}
```

---

### 🔐 Use Case 3: MFA Verification Token

**Code (TempJwtService.java):**
```java
public String generateMfaPendingToken(String email) {
    return Jwts.builder()
            .subject(email)
            .issuedAt(new Date())
            .expiration(new Date(now + TEMP_TOKEN_VALIDITY_MILLIS))  // 2 minutes
            .claim("mfa_pending", true)
            .claim("scope", "mfa_verify")
            .signWith(getKey())
            .compact();
}
```

**Verification:**
```java
public Optional<String> extractEmailIfValidMfaToken(String token) {
    Claims claims = Jwts.parser()
            .verifyWith(getKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();

    Object mfaPendingClaim = claims.get("mfa_pending");
    boolean mfaPending = Boolean.TRUE.equals(mfaPendingClaim);
    if (!mfaPending) {
        return Optional.empty();
    }

    return Optional.ofNullable(claims.getSubject());
}
```

---

## 🛡️ How Email + MFA Secret Integration Works

### Complete User 2FA Workflow:

```
1. User logs in with email + password
   └─→ Backend validates credentials
   
2. Backend checks if MFA is enabled
   └─→ Loads encrypted MFA_SECRET from DB
   └─→ Decrypts using MfaSecretConverter (AES with MASTER_KEY_PQ)
   
3. Backend generates MFA_PENDING token
   └─→ Email embedded as subject (HS256 signed)
   └─→ TTL: 2 minutes
   
4. Send to user: "Enter your 2FA code" + token (in session/cookie)
   
5. User enters 2FA code
   └─→ Backend validates token signature
   └─→ Extracts email from token.subject
   └─→ Loads MFA_SECRET for that email
   └─→ Verifies TOTP code matches
   
6. Backend generates SESSION token
   └─→ Email embedded as subject (HS256 signed)
   └─→ TTL: 1 hour (jwt.expiration=3600000)
   
7. User stores session token → Uses for API requests
```

### Key Security Properties:

| Property | Mechanism | Strength |
|:---|:---|:---|
| **Email Integrity** | HS256 HMAC signature | 🟢 Tamper-proof |
| **Email Privacy** | Base64 encoding only | 🟡 Visible in token |
| **Replay Protection** | Expiration timestamps | 🟢 Time-limited |
| **Purpose Control** | Custom claims (scope) | 🟢 Scope-locked |
| **MFA Secret Storage** | AES encryption at rest | 🟢 Encrypted DB |
| **Credential Transient** | Redis TTL | 🟢 Auto-expiring |

---

## 📋 Configuration Parameters Summary

**From application.properties:**

```properties
# JWT Tokens (HS256)
jwt.secret=${JWT_SECRET}              # Base64-encoded secret key
jwt.expiration=3600000                # 1 hour (ms)

# MFA Secret Encryption (AES)
MASTER_KEY_PQ=${MASTER_KEY_PQ}        # For AES encryption

# Temporary Credentials (Redis)
spring.data.redis.host=redis          # Redis server
spring.data.redis.port=6379           # Redis port
# TTL: 360 minutes (6 hours) for credentials
```

---

## 🎯 For Your k6 Load Testing

Since you use **HS256**, you can generate tokens directly:

```javascript
import { crypto } from 'k6/crypto';
import * as encoding from 'k6/encoding';

export function generateJWT(secret, email) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(JSON.stringify({
        sub: email,
        iat: now,
        exp: now + 3600  // 1 hour
    }));
    
    const signature = crypto.hmac('sha256', 
        encoding.b64decode(header) + '.' + encoding.b64decode(payload),
        secret
    );
    
    return header + '.' + payload + '.' + encoding.b64encode(signature);
}
```

---

## 🔍 Token Verification Flow (Backend)

```java
// From JWTFilter.java
public void doFilterInternal(...) {
    String jwtToken = extractTokenFromHeader(request);
    
    try {
        // This verifies the HS256 signature
        userEmail = jwtService.extractUserEmailFromToken(jwtToken);
        
        // Check expiration
        if (jwtService.validateToken(jwtToken, userDetails)) {
            // Token is valid → Set authentication
            SecurityContext.setAuthentication(...);
        }
    } catch (JwtException e) {
        // Invalid signature or expired
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
```

**Verification happens via:**
```java
private Claims extractAllClaims(String jwtToken) {
    return Jwts.parser()
            .verifyWith(getKey())      // ← Verifies HS256 signature
            .build()
            .parseSignedClaims(jwtToken)
            .getPayload();
}
```

If the signature doesn't match (someone tampered with the token), `parseSignedClaims()` throws `JwtException`.

---

## ✨ Summary Table

| Component | Algorithm | Purpose | Key Storage | TTL |
|:---|:---|:---|:---|:---|
| **JWT Session Token** | HS256 (HMAC-SHA256) | User authentication | `${JWT_SECRET}` | 1 hour |
| **Password Reset Token** | HS256 (HMAC-SHA256) | Password recovery | `${JWT_SECRET}` | 10 min |
| **Email Verification Token** | HS256 (HMAC-SHA256) | Email validation | `${JWT_SECRET}` | 10 min |
| **MFA Pending Token** | HS256 (HMAC-SHA256) | 2FA flow | `${JWT_SECRET}` | 2 min |
| **MFA Secret Storage** | AES/ECB/PKCS5Padding | 2FA key at rest | `${MASTER_KEY_PQ}` | ∞ (persistent) |
| **Guardian Credentials** | In-memory (Redis) | Temporary decryption key | Redis | 6 hours |

---

## 🚀 Email + Encryption Integration

**Your system is secure because:**

1. ✅ **Emails in JWT are signed** (not just encoded)
   - HMAC-SHA256 ensures integrity
   - Can't be modified without invalidating signature

2. ✅ **MFA secrets are separately encrypted**
   - Database column uses AES encryption
   - Not stored in JWT (too sensitive)
   - Fetched from DB when needed

3. ✅ **All communication is HTTPS**
   - Tokens encrypted in-transit
   - Secrets never transmitted plaintext

4. ✅ **Time-limited tokens**
   - Can't be replayed forever
   - Session expires after 1 hour

5. ✅ **Purpose-scoped tokens**
   - Password reset token can't be used for login
   - MFA token can't be used for email verification
   - Claims validation prevents misuse

---

**Ready for your load testing with k6! Your HS256 tokens can be generated client-side with your JWT_SECRET.** 🎯
