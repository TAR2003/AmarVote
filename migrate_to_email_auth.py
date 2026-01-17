#!/usr/bin/env python3
"""
Migration script to replace userId with userEmail across the codebase
Run this after backing up your code
"""

import os
import re
from pathlib import Path

# Base directory - adjust this to your backend/src/main/java directory
BASE_DIR = Path("c:/Users/TAWKIR/Documents/GitHub/AmarVote/backend/src/main/java/com/amarvote/amarvote")

def replace_in_file(filepath, replacements):
    """Apply multiple replacements to a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        for old, new in replacements:
            content = content.replace(old, new)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Updated: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def update_ballot_service():
    """Update BallotService.java"""
    filepath = BASE_DIR / "service" / "BallotService.java"
    
    replacements = [
        # Remove User import
        ("import com.amarvote.amarvote.model.User;\n", ""),
        ("import com.amarvote.amarvote.repository.UserRepository;\n", ""),
        
        # Remove UserRepository autowiring
        ("    @Autowired\n    private UserRepository userRepository;\n\n", ""),
        
        # Replace user lookup
        ("            Optional<User> userOpt = userRepository.findByUserEmail(userEmail);\n            if (!userOpt.isPresent()) {", 
         "            if (userEmail == null || userEmail.trim().isEmpty()) {"),
        
        ("            User user = userOpt.get();", ""),
        
        # Replace method calls with userId to userEmail
        ("checkVoterEligibility(user.getUserId(), election)", "checkVoterEligibility(userEmail, election)"),
        ("hasUserAlreadyVoted(user.getUserId(), election.getElectionId())", "hasUserAlreadyVoted(userEmail, election.getElectionId())"),
        ("VoterIdGenerator.generateBallotHashId(user.getUserId(), election.getElectionId())", 
         "VoterIdGenerator.generateBallotHashId(userEmail, election.getElectionId())"),
        ("updateVoterStatus(user.getUserId(), election)", "updateVoterStatus(userEmail, election)"),
        
        # Update method signatures
        ("private boolean checkVoterEligibility(Integer userId, Election election)", 
         "private boolean checkVoterEligibility(String userEmail, Election election)"),
        ("private boolean hasUserAlreadyVoted(Integer userId, Long electionId)", 
         "private boolean hasUserAlreadyVoted(String userEmail, Long electionId)"),
        ("private void updateVoterStatus(Integer userId, Election election)", 
         "private void updateVoterStatus(String userEmail, Election election)"),
        
        # Update method implementations
        (".anyMatch(av -> av.getUserId().equals(userId)", 
         ".anyMatch(av -> av.getUserEmail().equals(userEmail)"),
        (".filter(av -> av.getUserId().equals(userId))", 
         ".filter(av -> av.getUserEmail().equals(userEmail))"),
        ("                        .userId(userId)\n", 
         "                        .userEmail(userEmail)\n"),
        
        # Fix challenge methods
        ('user.getUserId()', 'userEmail'),
        ('"challenge-" + user.getUserId()', '"challenge-" + userEmail'),
    ]
    
    return replace_in_file(filepath, replacements)

def update_election_service():
    """Update ElectionService.java"""
    filepath = BASE_DIR / "service" / "ElectionService.java"
    
    replacements = [
        # Remove User import
        ("import com.amarvote.amarvote.model.User;\n", ""),
        ("import com.amarvote.amarvote.repository.UserRepository;\n", ""),
        
        # Remove UserRepository
        ("    @Autowired\n    private UserRepository userRepository;\n\n", ""),
        
        # Replace voter addition logic
        ("            Integer userId = userRepository.findByUserEmail(email)\n                    .orElseThrow(() -> new RuntimeException(\"User not found\"))\n                    .getUserId();",
         ""),
        ("                    .userId(userId)\n",
         "                    .userEmail(email)\n"),
        
        # Fix findByUserEmail calls
        ("userRepository.findByUserEmail(email)", "Optional.empty() // No user table"),
        
        # Fix guardian lookups  
        ("Optional<User> userOpt = userRepository.findById(guardian.getUserId());",
         "// Guardian email is guardian.getUserEmail()"),
        ("userOpt.get().getUserEmail()", "guardian.getUserEmail()"),
        
        # Fix comparisons
        (".anyMatch(av -> av.getUserId().equals(userOpt.get().getUserId())",
         ".anyMatch(av -> av.getUserEmail().equals(userEmail)"),
    ]
    
    return replace_in_file(filepath, replacements)

def update_user_search_service():
    """Update UserSearchService.java"""
    filepath = BASE_DIR / "service" / "UserSearchService.java"
    
    # This service likely needs to be deleted or completely rewritten
    # For now, just remove User dependencies
    replacements = [
        ("import com.amarvote.amarvote.model.User;\n", ""),
        ("import com.amarvote.amarvote.repository.UserRepository;\n", ""),
    ]
    
    return replace_in_file(filepath, replacements)

def update_dtos():
    """Update DTO files"""
    files = [
        BASE_DIR / "dto" / "UserProfileDTO.java",
        BASE_DIR / "dto" / "UserSearchResponse.java",
    ]
    
    for filepath in files:
        if filepath.exists():
            replacements = [
                ("private Integer userId;", "// userId removed - using email only"),
                ("Integer userId,", "// userId removed"),
                ("this.userId = userId;", ""),
                ("public Integer getUserId()", "// getUserId removed"),
                ("public void setUserId(Integer userId)", "// setUserId removed"),
            ]
            replace_in_file(filepath, replacements)

def delete_obsolete_files():
    """List files that should be deleted"""
    files_to_delete = [
        BASE_DIR / "model" / "User.java",
        BASE_DIR / "model" / "UserPrincipal.java",
        BASE_DIR / "model" / "PasswordResetToken.java",
        BASE_DIR / "model" / "VerificationCode.java",
        BASE_DIR / "repository" / "UserRepository.java",
        BASE_DIR / "repository" / "PasswordResetTokenRepository.java",
        BASE_DIR / "repository" / "VerificationCodeRepository.java",
        BASE_DIR / "service" / "UserService.java",
        BASE_DIR / "service" / "PasswordResetTokenService.java",
        BASE_DIR / "service" / "VerificationCodeService.java",
        BASE_DIR / "controller" / "UserController.java",
        BASE_DIR / "controller" / "PasswordController.java",
        BASE_DIR / "controller" / "VerificationController.java",
    ]
    
    print("\n📝 Files to manually delete:")
    for filepath in files_to_delete:
        if filepath.exists():
            print(f"   - {filepath}")
        else:
            print(f"   - {filepath} (already gone)")

def main():
    print("🚀 Starting AmarVote Migration: userId → userEmail\n")
    
    # Verify BASE_DIR exists
    if not BASE_DIR.exists():
        print(f"❌ Directory not found: {BASE_DIR}")
        print("Please update BASE_DIR in the script")
        return
    
    print("📦 Updating service files...\n")
    update_ballot_service()
    update_election_service()
    update_user_search_service()
    
    print("\n📦 Updating DTO files...\n")
    update_dtos()
    
    print("\n📦 Checking obsolete files...\n")
    delete_obsolete_files()
    
    print("\n✅ Migration script completed!")
    print("\n⚠️  IMPORTANT: This script handles common patterns.")
    print("    Please manually review and test all changes.")
    print("    Some files may need additional manual updates.")
    
    print("\n📋 Next steps:")
    print("    1. Review all changed files")
    print("    2. Delete the obsolete files listed above")
    print("    3. Run: mvn clean compile")
    print("    4. Fix any remaining compilation errors")
    print("    5. Test thoroughly")

if __name__ == "__main__":
    main()
