package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.service.ElectionGuardService;

@RestController
public class helloController {

    @Autowired
    private ElectionGuardService electionGuardService;

    @RequestMapping("/api/health")
    public String hello() {
        System.out.println("We are in the hello controller");
        return "Successfully connected with hello controller backend";
    }

    @GetMapping("/eg")
    public String getConnection() {
        System.out.println("Trying to connect to ElectionGuard backend...");
        try {
            String response = electionGuardService.getRequest("/health");
            return "ElectionGuard backend response: " + response;
        } catch (Exception e) {
            return "ElectionGuard backend connection failed: " + e.getMessage();
        }
    }
}