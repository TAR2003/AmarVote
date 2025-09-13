package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Comprehensive unit test suite for ElectionService class
 * 
 * This test class validates all the core functionality of the ElectionService including:
 * 
 * 1. INPUT VALIDATION TESTS:
 *    - Election creation validation (candidate/party picture count matching)
 *    - Data integrity checks
 * 
 * 2. AUTHORIZATION & ACCESS CONTROL TESTS:
 *    - Admin access to elections they created
 *    - Guardian access to elections they're assigned to  
 *    - Voter access to elections they're eligible for
 *    - Public election access for any user
 *    - Private election access restrictions
 *    - Multi-role user scenarios (admin + guardian)
 * 
 * 3. ELECTION RETRIEVAL TESTS:
 *    - Get election by ID with various access levels
 *    - Get elections for specific users based on their roles
 *    - Get elections by admin (elections they created)
 *    - Get elections by guardian (elections they manage)
 *    - Get all accessible elections (optimized query)
 * 
 * 4. DATA INTEGRITY TESTS:
 *    - Election choices retrieval and mapping
 *    - Guardian progress tracking (tally submissions)
 *    - User role determination and assignment
 *    - Privacy validation enforcement
 * 
 * 5. ERROR HANDLING TESTS:
 *    - Non-existent election handling
 *    - Unauthorized access attempts
 *    - Invalid input data scenarios
 * 
 * TESTING APPROACH:
 * - Uses Mockito for comprehensive mocking of all dependencies
 * - Focuses on testing business logic without external dependencies
 * - Tests both success and failure scenarios
 * - Validates DTOs and data mapping between layers
 * - Covers integration with the microservice architecture (ElectionGuard)
 * 
 * MOCKED DEPENDENCIES:
 * - ElectionRepository: Database operations for elections
 * - UserRepository: User data access
 * - GuardianRepository: Guardian role management
 * - ElectionChoiceRepository: Election options/candidates
 * - AllowedVoterRepository: Voter eligibility management
 * - EmailService: Email notifications (not tested in detail)
 * - ObjectMapper: JSON serialization (not tested in detail)
 */
@ExtendWith(MockitoExtension.class)
class ElectionServiceTest {

    @Mock
    private ElectionRepository electionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private GuardianRepository guardianRepository;

    @Mock
    private ElectionChoiceRepository electionChoiceRepository;

    @Mock
    private AllowedVoterRepository allowedVoterRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ObjectMapper objectMapper;

    private ElectionService electionService;

    private ElectionCreationRequest validElectionRequest;
    private Election mockElection;
    private User mockUser;

    /**
     * Test setup method executed before each test
     * 
     * This method initializes the test environment by:
     * - Creating ElectionService instance with mocked dependencies
     * - Injecting mocked repositories using ReflectionTestUtils
     * - Setting up common test data objects (mock election, user, requests)
     * - Preparing reusable mock objects for consistent test data
     * 
     * Uses ReflectionTestUtils to inject private dependencies that would
     * normally be injected by Spring's dependency injection framework.
     */
    @BeforeEach
    void setUp() {
        // Create ElectionService instance and inject mocks
        electionService = new ElectionService(electionRepository, null, objectMapper);
        ReflectionTestUtils.setField(electionService, "userRepository", userRepository);
        ReflectionTestUtils.setField(electionService, "guardianRepository", guardianRepository);
        ReflectionTestUtils.setField(electionService, "electionChoiceRepository", electionChoiceRepository);
        ReflectionTestUtils.setField(electionService, "allowedVoterRepository", allowedVoterRepository);
        ReflectionTestUtils.setField(electionService, "emailService", emailService);

        // Setup mock election request
        validElectionRequest = new ElectionCreationRequest(
                "Test Election",
                "Test Description",
                Arrays.asList("Candidate 1", "Candidate 2"),
                Arrays.asList("Party 1", "Party 2"),
                Arrays.asList("pic1.jpg", "pic2.jpg"),
                Arrays.asList("party1.jpg", "party2.jpg"),
                "3",
                "2",
                Arrays.asList("guardian1@test.com", "guardian2@test.com", "guardian3@test.com"),
                "public",
                "listed",
                Arrays.asList("voter1@test.com", "voter2@test.com"),
                Instant.now().plusSeconds(3600),
                Instant.now().plusSeconds(7200)
        );

        // Setup mock election
        mockElection = new Election();
        mockElection.setElectionId(1L);
        mockElection.setElectionTitle("Test Election");
        mockElection.setElectionDescription("Test Description");
        mockElection.setStatus("draft");
        mockElection.setAdminEmail("admin@test.com");
        mockElection.setPrivacy("public");
        mockElection.setEligibility("listed");

        // Setup mock user
        mockUser = new User();
        mockUser.setUserId(1);
        mockUser.setUserEmail("admin@test.com");
        mockUser.setUserName("Admin User");
    }

    /**
     * Test case: Election creation should fail when candidate pictures count doesn't match candidate names count
     * 
     * This test validates the input validation logic in createElection method.
     * It ensures that the service properly validates that each candidate must have exactly one picture.
     * 
     * Test scenario:
     * - Create an election request with 2 candidates but only 1 candidate picture
     * - Expect IllegalArgumentException with specific error message
     */
    @Test
    void testCreateElection_InvalidCandidatePicturesCount() {
        // Given: Create an invalid election request with mismatched candidate and picture counts
        ElectionCreationRequest invalidRequest = new ElectionCreationRequest(
                "Test Election",
                "Test Description",
                Arrays.asList("Candidate 1", "Candidate 2"),       // 2 candidates
                Arrays.asList("Party 1", "Party 2"),
                Arrays.asList("pic1.jpg"),                         // Only 1 picture for 2 candidates
                Arrays.asList("party1.jpg", "party2.jpg"),
                "3",
                "2",
                Arrays.asList("guardian1@test.com", "guardian2@test.com", "guardian3@test.com"),
                "public",
                "listed",
                Arrays.asList("voter1@test.com"),
                Instant.now().plusSeconds(3600),
                Instant.now().plusSeconds(7200)
        );

        // When & Then: Attempt to create election and expect validation error
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, 
                () -> electionService.createElection(invalidRequest, "jwt_token", "admin@test.com"));
        
        assertEquals("Candidate pictures count must match candidate names", exception.getMessage());
    }

    /**
     * Test case: Election creation should fail when party pictures count doesn't match party names count
     * 
     * This test validates another aspect of input validation in createElection method.
     * It ensures that the service properly validates that each party must have exactly one picture.
     * 
     * Test scenario:
     * - Create an election request with 2 parties but only 1 party picture
     * - Expect IllegalArgumentException with specific error message
     */
    @Test
    void testCreateElection_InvalidPartyPicturesCount() {
        // Given: Create an invalid election request with mismatched party and picture counts
        ElectionCreationRequest invalidRequest = new ElectionCreationRequest(
                "Test Election",
                "Test Description",
                Arrays.asList("Candidate 1", "Candidate 2"),
                Arrays.asList("Party 1", "Party 2"),               // 2 parties
                Arrays.asList("pic1.jpg", "pic2.jpg"),
                Arrays.asList("party1.jpg"),                       // Only 1 picture for 2 parties
                "3",
                "2",
                Arrays.asList("guardian1@test.com", "guardian2@test.com", "guardian3@test.com"),
                "public",
                "listed",
                Arrays.asList("voter1@test.com"),
                Instant.now().plusSeconds(3600),
                Instant.now().plusSeconds(7200)
        );

        // When & Then: Attempt to create election and expect validation error
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, 
                () -> electionService.createElection(invalidRequest, "jwt_token", "admin@test.com"));
        
        assertEquals("Party pictures count must match party names", exception.getMessage());
    }

    /**
     * Test case: Successfully retrieve all accessible elections for a user
     * 
     * This test validates the getAllAccessibleElections method which returns optimized election data
     * for elections that a user has access to (as admin, guardian, voter, or public elections).
     * 
     * Test scenario:
     * - Mock the repository to return election data in the format expected by OptimizedElectionResponse
     * - Call getAllAccessibleElections with a user email
     * - Verify that the response contains correctly mapped election data
     * - Verify that the repository method was called with the correct user email
     */
    @Test
    void testGetAllAccessibleElections_Success() {
        // Given: Setup mock data that matches the OptimizedElectionResponse.fromQueryResult() format
        String userEmail = "user@test.com";
        // Order based on OptimizedElectionResponse.fromQueryResult() method
        Object[] queryResult = new Object[]{
                1L,                                    // electionId (Long)
                "Test Election",                       // electionTitle (String)
                "Description",                         // electionDescription (String)  
                3,                                     // numberOfGuardians (Integer)
                3,                                     // electionQuorum (Integer)
                2,                                     // noOfCandidates (Integer)
                "joint_public_key",                    // jointPublicKey (skipped)
                "manifest_hash",                       // manifestHash (skipped)
                "draft",                               // status (String)
                Instant.now(),                         // startingTime (Instant)
                Instant.now().plusSeconds(3600),       // endingTime (Instant)
                null,                                  // encryptedTally (skipped)
                "base_hash",                           // baseHash (skipped)
                Instant.now(),                         // createdAt (Instant)
                null,                                  // profilePic (String)
                "admin@test.com",                      // adminEmail (String)
                "public",                              // privacy (String)
                "listed",                              // eligibility (String)
                "Admin User",                          // adminName (String)
                true,                                  // isAdmin (Boolean)
                false,                                 // isGuardian (Boolean)
                true,                                  // isVoter (Boolean)
                false                                  // hasVoted (Boolean)
        };
        
        List<Object[]> queryResults = new ArrayList<>();
        queryResults.add(queryResult);
        when(electionRepository.findOptimizedAccessibleElectionsWithDetails(userEmail))
                .thenReturn(queryResults);

        // When: Call the service method
        List<ElectionResponse> result = electionService.getAllAccessibleElections(userEmail);

        // Then: Verify the response structure and data
        assertNotNull(result);
        assertEquals(1, result.size());
        
        ElectionResponse response = result.get(0);
        assertEquals(1L, response.getElectionId());
        assertEquals("Test Election", response.getElectionTitle());
        assertEquals("admin@test.com", response.getAdminEmail());
        
        // Verify repository interaction
        verify(electionRepository, times(1)).findOptimizedAccessibleElectionsWithDetails(userEmail);
    }

    /**
     * Test case: Successfully retrieve election details when user is the admin
     * 
     * This test validates the getElectionById method for admin access scenarios.
     * Admins should have full access to their elections regardless of privacy settings.
     * 
     * Test scenario:
     * - Setup an election where the requesting user is the admin
     * - Mock all necessary repository calls
     * - Verify that admin gets full election details
     * - Verify that user roles include "admin"
     */
    @Test
    void testGetElectionById_Success_AdminAccess() {
        // Given: Setup election with user as admin
        Long electionId = 1L;
        String userEmail = "admin@test.com";
        
        mockElection.setAdminEmail(userEmail);
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(userRepository.findByUserEmail(userEmail)).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Request election details as admin
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify admin has access and correct role assignment
        assertNotNull(result);
        assertEquals(electionId, result.getElectionId());
        assertEquals("Test Election", result.getElectionTitle());
        assertEquals(userEmail, result.getAdminEmail());
        assertTrue(result.getUserRoles().contains("admin"));
        
        verify(electionRepository, times(1)).findById(electionId);
    }

    /**
     * Test case: Return null when election is not found
     * 
     * This test validates that the service properly handles non-existent elections.
     * When an election ID doesn't exist in the database, the service should return null.
     * 
     * Test scenario:
     * - Request an election with an ID that doesn't exist (999)
     * - Mock repository to return empty Optional
     * - Verify that service returns null
     */
    @Test
    void testGetElectionById_NotFound() {
        // Given: Setup request for non-existent election
        Long electionId = 999L;
        String userEmail = "user@test.com";
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.empty());

        // When: Request non-existent election
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify null response for non-existent election
        assertNull(result);
        verify(electionRepository, times(1)).findById(electionId);
    }

    /**
     * Test case: Deny access to private election for unauthorized users
     * 
     * This test validates the authorization logic for private elections.
     * Users who are not admin, guardian, or allowed voter should not access private elections.
     * 
     * Test scenario:
     * - Setup a private election with a different admin
     * - User is not a guardian or allowed voter for this election
     * - Mock repositories to return empty lists (no roles found)
     * - Verify that unauthorized user gets null response
     */
    @Test
    void testGetElectionById_UnauthorizedAccess() {
        // Given: Setup private election where user has no roles
        Long electionId = 1L;
        String userEmail = "unauthorized@test.com";
        
        mockElection.setAdminEmail("admin@test.com");  // Different admin
        mockElection.setPrivacy("private");             // Private election
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Unauthorized user attempts to access private election
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify access is denied
        assertNull(result);
        verify(electionRepository, times(1)).findById(electionId);
    }

    /**
     * Test case: Allow access to public elections for any user
     * 
     * This test validates that public elections can be accessed by any user,
     * regardless of whether they have specific roles (admin, guardian, voter).
     * 
     * Test scenario:
     * - Setup a public election with a different admin
     * - User has no specific roles in this election
     * - Mock all necessary repository calls for successful response
     * - Verify that any user can access public election details
     * - Verify that isPublic flag is set to true
     */
    @Test
    void testGetElectionById_PublicElectionAccess() {
        // Given: Setup public election accessible to any user
        Long electionId = 1L;
        String userEmail = "anyone@test.com";
        
        mockElection.setAdminEmail("admin@test.com");  // Different admin
        mockElection.setPrivacy("public");             // Public election
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(userRepository.findByUserEmail("admin@test.com")).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());

        // When: Any user requests public election details
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify public election access is granted
        assertNotNull(result);
        assertEquals(electionId, result.getElectionId());
        assertEquals("Test Election", result.getElectionTitle());
        assertTrue(result.getIsPublic());
        
        verify(electionRepository, times(1)).findById(electionId);
    }

    /**
     * Test case: Allow guardian access to elections they are assigned to
     * 
     * This test validates that users assigned as guardians can access election details
     * even if the election is private and they are not the admin.
     * 
     * Test scenario:
     * - Setup a private election with a different admin
     * - User is assigned as a guardian for this election
     * - Mock guardian repository to return guardian data
     * - Verify that guardian gets access and role is set correctly
     */
    @Test
    void testGetElectionById_GuardianAccess() {
        // Given: Setup election where user is a guardian
        Long electionId = 1L;
        String userEmail = "guardian@test.com";
        
        Guardian mockGuardian = new Guardian();
        mockGuardian.setElectionId(electionId);
        mockGuardian.setUserId(1);
        
        mockElection.setAdminEmail("admin@test.com");  // Different admin
        mockElection.setPrivacy("private");             // Private election
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList(mockGuardian));
        when(userRepository.findByUserEmail("admin@test.com")).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Guardian requests election details
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify guardian has access and correct role
        assertNotNull(result);
        assertEquals(electionId, result.getElectionId());
        assertTrue(result.getUserRoles().contains("guardian"));
        
        verify(electionRepository, times(1)).findById(electionId);
        verify(guardianRepository, times(2)).findByElectionIdAndUserEmail(electionId, userEmail);
    }

    /**
     * Test case: Allow voter access to elections they are eligible for
     * 
     * This test validates that users listed as allowed voters can access election details
     * even if the election is private and they are not the admin or guardian.
     * 
     * Test scenario:
     * - Setup a private election with a different admin
     * - User is listed as an allowed voter for this election
     * - Mock voter repository to return voter data
     * - Verify that voter gets access and role is set correctly
     */
    @Test
    void testGetElectionById_VoterAccess() {
        // Given: Setup election where user is an allowed voter
        Long electionId = 1L;
        String userEmail = "voter@test.com";
        
        AllowedVoter mockVoter = new AllowedVoter();
        mockVoter.setElectionId(electionId);
        mockVoter.setUserId(1);
        
        mockElection.setAdminEmail("admin@test.com");  // Different admin
        mockElection.setPrivacy("private");             // Private election
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList(mockVoter));
        when(userRepository.findByUserEmail("admin@test.com")).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());

        // When: Allowed voter requests election details
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify voter has access and correct role
        assertNotNull(result);
        assertEquals(electionId, result.getElectionId());
        assertTrue(result.getUserRoles().contains("voter"));
        
        verify(electionRepository, times(1)).findById(electionId);
        verify(allowedVoterRepository, times(2)).findByElectionIdAndUserEmail(electionId, userEmail);
    }

    /**
     * Test case: Successfully retrieve elections for a specific user
     * 
     * This test validates the getElectionsForUser method which returns elections
     * that a user has access to through various roles (admin, guardian, voter).
     * 
     * Test scenario:
     * - Mock repository to return elections for the user
     * - Mock role-checking repositories
     * - Verify that the service returns the expected elections
     * - Verify proper repository method calls
     */
    @Test
    void testGetElectionsForUser_Success() {
        // Given: Setup user with access to elections
        String userEmail = "user@test.com";
        when(electionRepository.findElectionsForUser(userEmail)).thenReturn(Arrays.asList(mockElection));
        when(allowedVoterRepository.findByElectionIdAndUserEmail(any(), eq(userEmail))).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(any(), eq(userEmail))).thenReturn(Arrays.asList());
        when(userRepository.findByUserEmail(userEmail)).thenReturn(Optional.of(mockUser));
        when(userRepository.findByUserEmail(mockElection.getAdminEmail())).thenReturn(Optional.of(mockUser));
        when(allowedVoterRepository.findByElectionId(any())).thenReturn(Arrays.asList());

        // When: Request elections for user
        List<ElectionResponse> result = electionService.getElectionsForUser(userEmail);

        // Then: Verify successful retrieval
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(electionRepository, times(1)).findElectionsForUser(userEmail);
    }

    /**
     * Test case: Successfully retrieve elections administered by a specific admin
     * 
     * This test validates the getElectionsByAdmin method which returns all elections
     * where the specified user is the admin/creator.
     * 
     * Test scenario:
     * - Mock repository to return elections created by the admin
     * - Mock role-checking repositories for the admin user
     * - Verify that the service returns elections where user is admin
     * - Verify proper repository method calls
     */
    @Test
    void testGetElectionsByAdmin_Success() {
        // Given: Setup admin user with created elections
        String adminEmail = "admin@test.com";
        when(electionRepository.findElectionsByAdmin(adminEmail)).thenReturn(Arrays.asList(mockElection));
        when(allowedVoterRepository.findByElectionIdAndUserEmail(any(), eq(adminEmail))).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(any(), eq(adminEmail))).thenReturn(Arrays.asList());
        when(userRepository.findByUserEmail(adminEmail)).thenReturn(Optional.of(mockUser));
        when(allowedVoterRepository.findByElectionId(any())).thenReturn(Arrays.asList());

        // When: Request elections by admin
        List<ElectionResponse> result = electionService.getElectionsByAdmin(adminEmail);

        // Then: Verify successful retrieval of admin's elections
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(electionRepository, times(1)).findElectionsByAdmin(adminEmail);
    }

    /**
     * Test case: Successfully retrieve elections where user is assigned as guardian
     * 
     * This test validates the getElectionsByGuardian method which returns all elections
     * where the specified user has been assigned as a guardian.
     * 
     * Test scenario:
     * - Mock repository to return elections where user is guardian
     * - Mock role-checking repositories for the guardian user
     * - Verify that the service returns elections where user has guardian role
     * - Verify proper repository method calls
     */
    @Test
    void testGetElectionsByGuardian_Success() {
        // Given: Setup guardian user with assigned elections
        String guardianEmail = "guardian@test.com";
        when(electionRepository.findElectionsByGuardian(guardianEmail)).thenReturn(Arrays.asList(mockElection));
        when(allowedVoterRepository.findByElectionIdAndUserEmail(any(), eq(guardianEmail))).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(any(), eq(guardianEmail))).thenReturn(Arrays.asList());
        when(userRepository.findByUserEmail(guardianEmail)).thenReturn(Optional.of(mockUser));
        when(userRepository.findByUserEmail(mockElection.getAdminEmail())).thenReturn(Optional.of(mockUser));
        when(allowedVoterRepository.findByElectionId(any())).thenReturn(Arrays.asList());

        // When: Request elections by guardian
        List<ElectionResponse> result = electionService.getElectionsByGuardian(guardianEmail);

        // Then: Verify successful retrieval of guardian's elections
        assertNotNull(result);
        assertEquals(1, result.size());
        verify(electionRepository, times(1)).findElectionsByGuardian(guardianEmail);
    }

    /**
     * Test case: Verify correct role assignment when user has multiple roles
     * 
     * This test validates that the service correctly identifies and assigns multiple roles
     * when a user has more than one role in an election (e.g., both admin and guardian).
     * 
     * Test scenario:
     * - Setup election where user is both admin and guardian
     * - Mock repositories to return data indicating both roles
     * - Verify that both "admin" and "guardian" roles are assigned
     * - Verify that the total role count is correct
     */
    @Test
    void testUserRolesDetermination_MultipleRoles() {
        // Given: Setup user with multiple roles (admin + guardian)
        Long electionId = 1L;
        String userEmail = "multirole@test.com";
        
        // User is both admin and guardian
        mockElection.setAdminEmail(userEmail);  // User is admin
        
        Guardian mockGuardian = new Guardian();
        mockGuardian.setElectionId(electionId);
        mockGuardian.setUserId(1);

        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList(mockGuardian));
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(userRepository.findByUserEmail(userEmail)).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());

        // When: Request election details for multi-role user
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify both roles are correctly assigned
        assertNotNull(result);
        assertTrue(result.getUserRoles().contains("admin"));
        assertTrue(result.getUserRoles().contains("guardian"));
        assertEquals(2, result.getUserRoles().size());
    }

    /**
     * Test case: Verify privacy validation works correctly for private elections
     * 
     * This test validates that the privacy settings are properly enforced.
     * Users without specific roles should not access private elections.
     * 
     * Test scenario:
     * - Setup a private election with a different admin
     * - User has no roles (not admin, guardian, or voter)
     * - Verify that access is denied (null response)
     * - Verify proper repository method calls for authorization checks
     */
    @Test
    void testElectionPrivacyValidation_PrivateElection() {
        // Given: Setup private election with outsider user (no roles)
        Long electionId = 1L;
        String userEmail = "outsider@test.com";
        
        mockElection.setAdminEmail("admin@test.com");  // Different admin
        mockElection.setPrivacy("private");             // Private election
        
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Outsider attempts to access private election
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify access is properly denied for private election
        assertNull(result); // Should not have access to private election
        verify(electionRepository, times(1)).findById(electionId);
    }

    /**
     * Test case: Verify election choices are properly retrieved and included in response
     * 
     * This test validates that the service correctly retrieves and includes
     * all election choices (candidates/options) in the election detail response.
     * 
     * Test scenario:
     * - Setup election with multiple choices/candidates
     * - Mock repository to return election choices
     * - Verify that all choices are included in the response
     * - Verify choice details are correctly mapped
     */
    @Test
    void testElectionChoicesRetrieval() {
        // Given: Setup election with multiple candidates/choices
        Long electionId = 1L;
        String userEmail = "admin@test.com";
        
        ElectionChoice choice1 = new ElectionChoice();
        choice1.setChoiceId(1L);
        choice1.setOptionTitle("Candidate 1");
        choice1.setPartyName("Party 1");
        choice1.setTotalVotes(0);
        
        ElectionChoice choice2 = new ElectionChoice();
        choice2.setChoiceId(2L);
        choice2.setOptionTitle("Candidate 2");
        choice2.setPartyName("Party 2");
        choice2.setTotalVotes(0);
        
        mockElection.setAdminEmail(userEmail);
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(userRepository.findByUserEmail(userEmail)).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList(choice1, choice2));
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Request election details to get choices
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify election choices are properly retrieved and mapped
        assertNotNull(result);
        assertEquals(2, result.getElectionChoices().size());
        assertEquals("Candidate 1", result.getElectionChoices().get(0).getOptionTitle());
        assertEquals("Candidate 2", result.getElectionChoices().get(1).getOptionTitle());
        
        verify(electionChoiceRepository, times(1)).findByElectionIdOrderByChoiceIdAsc(electionId);
    }

    /**
     * Test case: Verify guardian progress calculation for tally submission tracking
     * 
     * This test validates that the service correctly calculates and tracks guardian progress
     * in the election process, specifically for tally share submissions.
     * 
     * Test scenario:
     * - Setup election with multiple guardians
     * - Some guardians have submitted tally shares, others haven't
     * - Verify that progress counters are correctly calculated
     * - Verify that completion status is accurately determined
     */
    @Test
    void testGuardianProgressCalculation() {
        // Given: Setup election with mixed guardian submission status
        Long electionId = 1L;
        String userEmail = "admin@test.com";
        
        // Setup guardian data with one guardian having submitted their tally
        Guardian guardian1 = new Guardian();
        guardian1.setUserId(1);
        guardian1.setTallyShare("tally_share_data"); // Has submitted
        
        Guardian guardian2 = new Guardian();
        guardian2.setUserId(2);
        guardian2.setTallyShare(null); // Has not submitted
        
        Object[] guardianData1 = {guardian1, mockUser};
        Object[] guardianData2 = {guardian2, mockUser};
        
        mockElection.setAdminEmail(userEmail);
        when(electionRepository.findById(electionId)).thenReturn(Optional.of(mockElection));
        when(userRepository.findByUserEmail(userEmail)).thenReturn(Optional.of(mockUser));
        when(guardianRepository.findGuardiansWithUserDetailsByElectionId(electionId))
                .thenReturn(Arrays.asList(guardianData1, guardianData2));
        when(allowedVoterRepository.findAllowedVotersWithUserDetailsByElectionId(electionId)).thenReturn(Arrays.asList());
        when(electionChoiceRepository.findByElectionIdOrderByChoiceIdAsc(electionId)).thenReturn(Arrays.asList());
        when(allowedVoterRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());
        when(guardianRepository.findByElectionIdAndUserEmail(electionId, userEmail)).thenReturn(Arrays.asList());

        // When: Request election details to check guardian progress
        ElectionDetailResponse result = electionService.getElectionById(electionId, userEmail);

        // Then: Verify guardian progress is correctly calculated
        assertNotNull(result);
        assertEquals(2, result.getTotalGuardians());                    // Total guardians count
        assertEquals(1, result.getGuardiansSubmitted());                // Only one guardian submitted
        assertFalse(result.getAllGuardiansSubmitted());                 // Not all guardians submitted
        
        verify(guardianRepository, times(1)).findGuardiansWithUserDetailsByElectionId(electionId);
    }
}
