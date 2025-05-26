package com.amarvote.amarvote;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import com.amarvote.amarvote.repository.UserRepository;
// import com.amarvote.amarvote.model.User;

@RestController
public class helloController {

    @Autowired
    private UserRepository userRepository;

    @RequestMapping("/hello")
    public String hello() {
        return "Hello, World!";
    }
    
    @GetMapping("/users/count")
    public String getUsersCount() {
        long count = userRepository.count();
        return "Total users in database: " + count;
    }
    
    @GetMapping("/users/{email}")
    public ResponseEntity<?> getUserByEmail(@PathVariable String email) {
        return userRepository.findByUserEmail(email)
                .map(user -> ResponseEntity.ok().body(user))
                .orElse(ResponseEntity.notFound().build());
    }
}