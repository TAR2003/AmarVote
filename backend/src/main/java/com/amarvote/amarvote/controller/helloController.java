package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


import com.amarvote.amarvote.repository.UserRepository;

@RestController
public class helloController {

    @Autowired
    private UserRepository userRepository;

    // @Autowired
    // private WebClient webClient; // Injected WebClient

    @RequestMapping("/hello")
    public String hello() {
        System.out.println("We are in the hello controller");
        return "Successfully connected with hello controoler backiend";
    }

    // // Example: Fetch data from Python service with a dynamic path
    // @GetMapping("/python-data/{id}")
    // public Mono<String> getPythonData(@PathVariable String id) {
    //     return webClient.get()
    //             .uri("/data/{id}", id) // Calls http://localhost:5000/data/{id}
    //             .retrieve()
    //             .bodyToMono(String.class);
    // }

    // Keep your existing methods unchanged
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

    // @GetMapping("/eg")
    // public String getConnection() {
    //     System.out.println("Trying to connect to backend...");
    //     String response = webClient.get()
    //             .uri("http://host.docker.internal:5000/health") // 👈 Use host.docker.internal
    //             .retrieve()
    //             .bodyToMono(String.class)
    //             .block();
    //     return "Backend response: " + response;
    // }
}