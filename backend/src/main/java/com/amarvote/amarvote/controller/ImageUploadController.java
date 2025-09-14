package com.amarvote.amarvote.controller;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionChoice;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.ElectionChoiceRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.UserRepository;
import com.amarvote.amarvote.service.CloudinaryService;

@RestController
@RequestMapping("/api/images")
public class ImageUploadController {

    @Autowired
    private CloudinaryService cloudinaryService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private ElectionChoiceRepository electionChoiceRepository;

    /**
     * Upload profile picture for authenticated user
     */
    @PostMapping("/profile")
    public ResponseEntity<?> uploadProfilePicture(@RequestParam("file") MultipartFile file) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Authentication required"));
        }

        try {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String email = userDetails.getUsername();

            // Find user
            Optional<User> userOpt = userRepository.findByUserEmail(email);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "User not found"));
            }

            User user = userOpt.get();

            // Delete old profile picture if exists
            if (user.getProfilePic() != null && !user.getProfilePic().isEmpty()) {
                cloudinaryService.deleteImage(user.getProfilePic());
            }

            // Upload new image
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PROFILE);
            
            // Update user profile
            user.setProfilePic(imageUrl);
            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Profile picture updated successfully",
                    "imageUrl", imageUrl
            ));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to upload image: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "An unexpected error occurred"));
        }
    }

    /**
     * Upload election profile picture (for election administrators)
     */
    @PostMapping("/election")
    public ResponseEntity<?> uploadElectionPicture(
            @RequestParam("file") MultipartFile file,
            @RequestParam("electionId") Long electionId) {
        
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Authentication required"));
        }

        try {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String email = userDetails.getUsername();

            // Find election
            Optional<Election> electionOpt = electionRepository.findById(electionId);
            if (electionOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election not found"));
            }

            Election election = electionOpt.get();

            // Check if user is the election administrator
            if (!email.equals(election.getAdminEmail())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("success", false, "message", "Only election administrator can update election picture"));
            }

            // Delete old profile picture if exists
            if (election.getProfilePic() != null && !election.getProfilePic().isEmpty()) {
                cloudinaryService.deleteImage(election.getProfilePic());
            }

            // Upload new image
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PROFILE);
            
            // Update election profile
            election.setProfilePic(imageUrl);
            electionRepository.save(election);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Election picture updated successfully",
                    "imageUrl", imageUrl
            ));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to upload image: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "An unexpected error occurred"));
        }
    }

    /**
     * Upload candidate picture
     */
    @PostMapping("/candidate")
    public ResponseEntity<?> uploadCandidatePicture(
            @RequestParam("file") MultipartFile file,
            @RequestParam("choiceId") Long choiceId) {
        
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Authentication required"));
        }

        try {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String email = userDetails.getUsername();

            // Find election choice
            Optional<ElectionChoice> choiceOpt = electionChoiceRepository.findById(choiceId);
            if (choiceOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election choice not found"));
            }

            ElectionChoice choice = choiceOpt.get();

            // Find the election to check permissions
            Optional<Election> electionOpt = electionRepository.findById(choice.getElectionId());
            if (electionOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election not found"));
            }

            Election election = electionOpt.get();

            // Check if user is the election administrator
            if (!email.equals(election.getAdminEmail())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("success", false, "message", "Only election administrator can update candidate picture"));
            }

            // Delete old candidate picture if exists
            if (choice.getCandidatePic() != null && !choice.getCandidatePic().isEmpty()) {
                cloudinaryService.deleteImage(choice.getCandidatePic());
            }

            // Upload new image
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.CANDIDATE);
            
            // Update candidate picture
            choice.setCandidatePic(imageUrl);
            electionChoiceRepository.save(choice);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Candidate picture updated successfully",
                    "imageUrl", imageUrl
            ));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to upload image: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "An unexpected error occurred"));
        }
    }

    /**
     * Upload party picture
     */
    @PostMapping("/party")
    public ResponseEntity<?> uploadPartyPicture(
            @RequestParam("file") MultipartFile file,
            @RequestParam("choiceId") Long choiceId) {
        
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Authentication required"));
        }

        try {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String email = userDetails.getUsername();

            // Find election choice
            Optional<ElectionChoice> choiceOpt = electionChoiceRepository.findById(choiceId);
            if (choiceOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election choice not found"));
            }

            ElectionChoice choice = choiceOpt.get();

            // Find the election to check permissions
            Optional<Election> electionOpt = electionRepository.findById(choice.getElectionId());
            if (electionOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election not found"));
            }

            Election election = electionOpt.get();

            // Check if user is the election administrator
            if (!email.equals(election.getAdminEmail())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("success", false, "message", "Only election administrator can update party picture"));
            }

            // Delete old party picture if exists
            if (choice.getPartyPic() != null && !choice.getPartyPic().isEmpty()) {
                cloudinaryService.deleteImage(choice.getPartyPic());
            }

            // Upload new image
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PARTY);
            
            // Update party picture
            choice.setPartyPic(imageUrl);
            electionChoiceRepository.save(choice);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Party picture updated successfully",
                    "imageUrl", imageUrl
            ));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to upload image: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "An unexpected error occurred"));
        }
    }
}