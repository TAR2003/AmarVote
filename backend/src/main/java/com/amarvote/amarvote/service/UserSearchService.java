package com.amarvote.amarvote.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.UserSearchResponse;
import com.amarvote.amarvote.repository.UserRepository;

@Service
public class UserSearchService {
    
    @Autowired
    private UserRepository userRepository;
    
    /**
     * Search users by email or name containing the given query string
     * 
     * @param query The search query
     * @return List of users matching the search criteria
     */
    public List<UserSearchResponse> searchUsersByEmailOrName(String query) {
        // Find all users and filter in memory
        // In a production app, you would use a more efficient query
        return userRepository.findAll().stream()
            .filter(user -> containsIgnoreCase(user.getUserEmail(), query) || 
                           (user.getUserName() != null && containsIgnoreCase(user.getUserName(), query)))
            .map(user -> new UserSearchResponse(
                user.getUserId(),
                user.getUserEmail(),
                user.getUserName(),
                user.getProfilePic()
            ))
            .collect(Collectors.toList());
    }
    
    /**
     * Get total number of users in the system
     * 
     * @return The count of users
     */
    public long getUserCount() {
        return userRepository.count();
    }
    
    private boolean containsIgnoreCase(String text, String searchTerm) {
        return text != null && text.toLowerCase().contains(searchTerm.toLowerCase());
    }
}
