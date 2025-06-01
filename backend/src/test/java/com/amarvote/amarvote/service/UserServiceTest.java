package com.amarvote.amarvote.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    // @Mock
    // private UserRepository userRepository;

    // @InjectMocks
    // private UserService userService;

    // @Test
    // void testFindByUserEmail_WhenUserExists() {
    //     // Arrange
    //     User mockUser = new User();
    //     mockUser.setUserName("amar");
    //     mockUser.setUserEmail("amar@example.com");

    //     when(userRepository.findByUserEmail("amar@example.com"))
    //             .thenReturn(Optional.of(mockUser));

    //     // Act
    //     User result = userService.findByUserEmail("amar@example.com");

    //     // Assert
    //     assertNotNull(result);
    //     assertEquals("amar", result.getUserName());
    //     assertEquals("amar@example.com", result.getUserEmail());
    //     verify(userRepository, times(1)).findByUserEmail("amar@example.com");
    // }

    // @Test
    // void testFindByUsername_WhenUserDoesNotExist() {
    //     // Arrange
    //     when(userRepository.findByUserEmail("unknown@example.com"))
    //             .thenReturn(Optional.empty());

    //     // Act & Assert
    //     RuntimeException exception = assertThrows(RuntimeException.class,
    //             () -> userService.findByUserEmail("unknown@example.com"));

    //     assertEquals("User not found", exception.getMessage());
    //     verify(userRepository, times(1)).findByUserEmail("unknown@example.com");
    // }
}
