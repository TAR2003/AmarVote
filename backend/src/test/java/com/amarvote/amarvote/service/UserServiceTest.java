package com.amarvote.amarvote.service;

import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

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
