package com.amarvote.amarvote.service;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.amarvote.amarvote.dto.LoginRequest;
import com.amarvote.amarvote.dto.LoginResponse;
import com.amarvote.amarvote.dto.RegisterRequest;
import com.amarvote.amarvote.dto.RegisterResponse;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JWTService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private BCryptPasswordEncoder encoder;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private UserService userService;

    private RegisterRequest validRegisterRequest;
    private User mockUser;
    private LoginRequest validLoginRequest;

    @BeforeEach
    void setUp() {
        // Setup valid register request
        validRegisterRequest = new RegisterRequest();
        validRegisterRequest.setUserName("testuser");
        validRegisterRequest.setEmail("test@example.com");
        validRegisterRequest.setPassword("Password123!");
        validRegisterRequest.setConfirmPassword("Password123!");
        validRegisterRequest.setProfilePic("profile.jpg");

        // Setup mock user
        mockUser = new User();
        mockUser.setUserId(1);
        mockUser.setUserName("testuser");
        mockUser.setUserEmail("test@example.com");
        mockUser.setPasswordHash("$2a$12$hashedPassword");
        mockUser.setVerified(false);
        mockUser.setCreatedAt(OffsetDateTime.now());
        mockUser.setProfilePic("profile.jpg");

        // Setup valid login request
        validLoginRequest = new LoginRequest();
        validLoginRequest.setEmail("test@example.com");
        validLoginRequest.setPassword("Password123!");

        // Inject the mocked encoder into the UserService using reflection
        ReflectionTestUtils.setField(userService, "encoder", encoder);
    }

    // ================== REGISTER TESTS ==================
    /**
     * Test successful user registration with valid data. Verifies that when all
     * registration data is valid and the email doesn't already exist, the user
     * is successfully registered and appropriate repository methods are called.
     */
    @Test
    void testRegister_Success() {
        // Arrange
        when(userRepository.findByUserEmail(validRegisterRequest.getEmail()))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act
        RegisterResponse response = userService.register(validRegisterRequest);

        // Assert
        assertTrue(response.isSuccess());
        assertEquals("User registered successfully", response.getMessage());

        verify(userRepository, times(1)).findByUserEmail(validRegisterRequest.getEmail());
        verify(userRepository, times(1)).save(any(User.class));
    }

    /**
     * Test registration failure when password and confirm password don't match.
     * Verifies that the registration process validates password confirmation
     * and returns appropriate error message without attempting to save the
     * user.
     */
    @Test
    void testRegister_PasswordMismatch() {
        // Arrange
        validRegisterRequest.setConfirmPassword("DifferentPassword123!");

        // Act
        RegisterResponse response = userService.register(validRegisterRequest);

        // Assert
        assertFalse(response.isSuccess());
        assertEquals("Password and Confirm Password do not match", response.getMessage());

        verify(userRepository, never()).findByUserEmail(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    /**
     * Test registration failure when attempting to register with an email that
     * already exists. Verifies that the system prevents duplicate user
     * registration by checking existing emails and returns appropriate error
     * message without creating a new user.
     */
    @Test
    void testRegister_UserAlreadyExists() {
        // Arrange
        when(userRepository.findByUserEmail(validRegisterRequest.getEmail()))
                .thenReturn(Optional.of(mockUser));

        // Act
        RegisterResponse response = userService.register(validRegisterRequest);

        // Assert
        assertFalse(response.isSuccess());
        assertEquals("User with this email already exists", response.getMessage());

        verify(userRepository, times(1)).findByUserEmail(validRegisterRequest.getEmail());
        verify(userRepository, never()).save(any(User.class));
    }

    /**
     * Test registration with null profile picture. Verifies that the system
     * correctly handles null profile pictures by setting them to null in the
     * saved user object, ensuring optional fields are properly managed.
     */
    @Test
    void testRegister_WithNullProfilePic() {
        // Arrange
        validRegisterRequest.setProfilePic(null);
        when(userRepository.findByUserEmail(validRegisterRequest.getEmail()))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act
        RegisterResponse response = userService.register(validRegisterRequest);

        // Assert
        assertTrue(response.isSuccess());
        assertEquals("User registered successfully", response.getMessage());

        verify(userRepository, times(1)).save(argThat(user -> user.getProfilePic() == null));
    }

    /**
     * Test registration with empty string profile picture. Verifies that the
     * system treats empty string profile pictures the same as null, converting
     * them to null in the saved user object for consistency.
     */
    @Test
    void testRegister_WithEmptyProfilePic() {
        // Arrange
        validRegisterRequest.setProfilePic("");
        when(userRepository.findByUserEmail(validRegisterRequest.getEmail()))
                .thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act
        RegisterResponse response = userService.register(validRegisterRequest);

        // Assert
        assertTrue(response.isSuccess());
        assertEquals("User registered successfully", response.getMessage());

        verify(userRepository, times(1)).save(argThat(user -> user.getProfilePic() == null));
    }

    // ================== LOGIN/VERIFY TESTS ==================
    /**
     * Test successful user login/verification with valid credentials. Verifies
     * that when valid email and password are provided, the authentication is
     * successful, JWT token is generated, and proper response is returned.
     */
    @Test
    void testVerify_Success() {
        // Arrange
        String expectedToken = "jwt-token-123";
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(jwtService.generateJWTToken(validLoginRequest.getEmail()))
                .thenReturn(expectedToken);

        // Act
        LoginResponse response = userService.verify(validLoginRequest);

        // Assert
        assertTrue(response.isSuccess());
        assertEquals("User login successful", response.getMessage());
        assertEquals(expectedToken, response.getToken());
        assertEquals(validLoginRequest.getEmail(), response.getEmail());

        verify(authenticationManager, times(1))
                .authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(jwtService, times(1)).generateJWTToken(validLoginRequest.getEmail());
    }

    /**
     * Test login failure with invalid credentials. Verifies that when invalid
     * email or password is provided, the authentication fails, appropriate
     * error message is returned, and no JWT token is generated.
     */
    @Test
    void testVerify_InvalidCredentials() {
        // Arrange
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        // Act
        LoginResponse response = userService.verify(validLoginRequest);

        // Assert
        assertFalse(response.isSuccess());
        assertEquals("Invalid email or password", response.getMessage());
        assertNull(response.getToken());
        assertNull(response.getEmail());

        verify(authenticationManager, times(1))
                .authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(jwtService, never()).generateJWTToken(anyString());
    }

    // ================== EXISTS BY EMAIL TESTS ==================
    /**
     * Test checking if a user exists by email when the user actually exists.
     * Verifies that the service correctly identifies existing users by their
     * email address and returns true when the user is found in the repository.
     */
    @Test
    void testExistsByEmail_UserExists() {
        // Arrange
        when(userRepository.existsByUserEmail("test@example.com")).thenReturn(true);

        // Act
        boolean exists = userService.existsByEmail("test@example.com");

        // Assert
        assertTrue(exists);
        verify(userRepository, times(1)).existsByUserEmail("test@example.com");
    }

    /**
     * Test checking if a user exists by email when the user does not exist.
     * Verifies that the service correctly handles non-existent users by their
     * email address and returns false when the user is not found in the
     * repository.
     */
    @Test
    void testExistsByEmail_UserDoesNotExist() {
        // Arrange
        when(userRepository.existsByUserEmail("nonexistent@example.com")).thenReturn(false);

        // Act
        boolean exists = userService.existsByEmail("nonexistent@example.com");

        // Assert
        assertFalse(exists);
        verify(userRepository, times(1)).existsByUserEmail("nonexistent@example.com");
    }

    // ================== CHECK PASSWORD TESTS ==================
    /**
     * Test password verification with correct password. Verifies that when a
     * user exists and the provided password matches the stored hash, the method
     * returns true. Tests the integration with BCryptPasswordEncoder for
     * password matching.
     */
    @Test
    void testCheckPassword_CorrectPassword() {
        // Arrange
        String rawPassword = "Password123!";
        String hashedPassword = "$2a$12$hashedPassword";
        mockUser.setPasswordHash(hashedPassword);

        when(userRepository.findByUserEmail("test@example.com"))
                .thenReturn(Optional.of(mockUser));
        when(encoder.matches(rawPassword, hashedPassword))
                .thenReturn(true);

        // Act
        boolean isCorrect = userService.checkPassword("test@example.com", rawPassword);

        // Assert
        assertTrue(isCorrect);
        verify(userRepository, times(1)).findByUserEmail("test@example.com");
        verify(encoder, times(1)).matches(rawPassword, hashedPassword);
    }

    /**
     * Test password verification with incorrect password. Verifies that when a
     * user exists but the provided password does not match the stored hash, the
     * method returns false. Tests password security by ensuring wrong passwords
     * are rejected.
     */
    @Test
    void testCheckPassword_IncorrectPassword() {
        // Arrange
        String wrongPassword = "WrongPassword";
        String hashedPassword = "$2a$12$hashedPassword";
        mockUser.setPasswordHash(hashedPassword);

        when(userRepository.findByUserEmail("test@example.com"))
                .thenReturn(Optional.of(mockUser));
        when(encoder.matches(wrongPassword, hashedPassword))
                .thenReturn(false);

        // Act
        boolean isCorrect = userService.checkPassword("test@example.com", wrongPassword);

        // Assert
        assertFalse(isCorrect);
        verify(userRepository, times(1)).findByUserEmail("test@example.com");
        verify(encoder, times(1)).matches(wrongPassword, hashedPassword);
    }

    /**
     * Test password verification when user does not exist. Verifies that when
     * attempting to check password for a non-existent user, the method returns
     * false without attempting password comparison.
     */
    @Test
    void testCheckPassword_UserNotFound() {
        // Arrange
        when(userRepository.findByUserEmail("nonexistent@example.com"))
                .thenReturn(Optional.empty());

        // Act
        boolean isCorrect = userService.checkPassword("nonexistent@example.com", "AnyPassword");

        // Assert
        assertFalse(isCorrect);
        verify(userRepository, times(1)).findByUserEmail("nonexistent@example.com");
    }

    // ================== UPDATE PASSWORD TESTS ==================
    /**
     * Test successful password update for an existing user. Verifies that when
     * a user exists, their password can be successfully updated with proper
     * hashing and the updated user is saved to the repository.
     */
    @Test
    void testUpdatePasswordByEmail_Success() {
        // Arrange
        when(userRepository.findByUserEmail("test@example.com"))
                .thenReturn(Optional.of(mockUser));
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act
        userService.updatePasswordByEmail("test@example.com", "NewPassword123!");

        // Assert
        verify(userRepository, times(1)).findByUserEmail("test@example.com");
        verify(userRepository, times(1)).save(mockUser);
    }

    /**
     * Test password update attempt for a non-existent user. Verifies that when
     * attempting to update password for a user that doesn't exist, the method
     * handles it gracefully without throwing exceptions and no save operation
     * occurs.
     */
    @Test
    void testUpdatePasswordByEmail_UserNotFound() {
        // Arrange
        when(userRepository.findByUserEmail("nonexistent@example.com"))
                .thenReturn(Optional.empty());

        // Act
        userService.updatePasswordByEmail("nonexistent@example.com", "NewPassword123!");

        // Assert
        verify(userRepository, times(1)).findByUserEmail("nonexistent@example.com");
        verify(userRepository, never()).save(any(User.class));
    }

    /**
     * Test that password encoding is actually called during password update.
     * Verifies that the BCryptPasswordEncoder is properly used when updating
     * passwords.
     */
    @Test
    void testUpdatePasswordByEmail_PasswordEncoding() {
        // Arrange
        String newPassword = "NewPassword123!";
        String hashedPassword = "$2a$12$newHashedPassword";

        when(userRepository.findByUserEmail("test@example.com"))
                .thenReturn(Optional.of(mockUser));
        when(encoder.encode(newPassword)).thenReturn(hashedPassword);
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        // Act
        userService.updatePasswordByEmail("test@example.com", newPassword);

        // Assert
        verify(encoder, times(1)).encode(newPassword);
        verify(userRepository, times(1)).save(argThat(user
                -> hashedPassword.equals(user.getPassword())));
    }

    // ================== GET JWT TOKEN TESTS ==================
    /**
     * Test successful JWT token generation for a valid email. Verifies that the
     * service correctly delegates JWT token generation to the JWT service and
     * returns the generated token for authenticated users.
     */
    @Test
    void testGetJwtToken_Success() {
        // Arrange
        String expectedToken = "jwt-token-456";
        when(jwtService.generateJWTToken("test@example.com")).thenReturn(expectedToken);

        // Act
        String token = userService.getJwtToken("test@example.com");

        // Assert
        assertEquals(expectedToken, token);
        verify(jwtService, times(1)).generateJWTToken("test@example.com");
    }

    /**
     * Test JWT token generation with null email input. Verifies that the
     * service handles edge cases gracefully when null email is provided,
     * ensuring the system doesn't break and returns appropriate null response.
     */
    @Test
    void testGetJwtToken_WithNullEmail() {
        // Arrange
        when(jwtService.generateJWTToken(null)).thenReturn(null);

        // Act
        String token = userService.getJwtToken(null);

        // Assert
        assertNull(token);
        verify(jwtService, times(1)).generateJWTToken(null);
    }
}
