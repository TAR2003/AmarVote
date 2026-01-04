package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;

@RestController
public class helloController {

    @Autowired
    private WebClient webClient; // Injected WebClient

    @RequestMapping("/api/health")
    public String hello() {
        System.out.println("We are in the hello controller");
        return "Successfully connected with hello controller backend";
    }

    // Example: Fetch data from Python service with a dynamic path
    @GetMapping("/python-data/{id}")
    public Mono<String> getPythonData(@PathVariable String id) {
        return webClient.get()
                .uri("/data/{id}", id) // Calls http://localhost:5000/data/{id}
                .retrieve()
                .bodyToMono(String.class);
    }

    @GetMapping("/eg")
    public String getConnection() {
        System.out.println("Trying to connect to backend...");
        String response = webClient.get()
                .uri("/health") // 👈 Use host.docker.internal
                .retrieve()
                .bodyToMono(String.class)
                .block(java.time.Duration.ofMinutes(5)); // Explicit 5-minute timeout
        return "Backend response: " + response;
    }
}