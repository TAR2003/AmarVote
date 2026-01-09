package com.amarvote.amarvote.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.OtpLoginResponseDto;
import com.amarvote.amarvote.model.ApiLog;
import com.amarvote.amarvote.service.ApiLogService;
import com.amarvote.amarvote.util.JwtUtil;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private ApiLogService apiLogService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Value("${LOG_PASSWORD:amarvote123}")
    private String logPassword;
    
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    /**
     * Admin login endpoint
     * Only accepts username="admin" and password from LOG_PASSWORD env variable
     */
    @PostMapping("/login")
    public ResponseEntity<OtpLoginResponseDto> adminLogin(
            @Valid @RequestBody AdminLoginRequest request,
            HttpServletResponse response) {
        
        // Validate credentials
        if (!"admin".equals(request.getUsername()) || !logPassword.equals(request.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new OtpLoginResponseDto(false, "Invalid admin credentials", null));
        }
        
        // Generate token with "admin" as email
        String token = jwtUtil.generateToken("admin");
        
        // Set HTTP-only cookie
        Cookie cookie = new Cookie("jwtToken", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
        
        return ResponseEntity.ok(new OtpLoginResponseDto(true, "Admin login successful", token));
    }

    /**
     * Get API logs - only accessible by admin
     */
    @GetMapping("/logs")
    public ResponseEntity<?> getApiLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) String path) {
        
        // Check if user is admin
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        if (!"admin".equals(userDetails.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. Only admin can view logs.");
        }
        
        // Get logs based on filters
        Page<ApiLog> logs;
        if (email != null && !email.isEmpty()) {
            logs = apiLogService.getLogsByEmail(email, page, size);
        } else if (ip != null && !ip.isEmpty()) {
            logs = apiLogService.getLogsByIp(ip, page, size);
        } else if (path != null && !path.isEmpty()) {
            logs = apiLogService.getLogsByPath(path, page, size);
        } else {
            logs = apiLogService.getAllLogs(page, size);
        }
        
        return ResponseEntity.ok(logs);
    }

    /**
     * Get API logs statistics
     */
    @GetMapping("/logs/stats")
    public ResponseEntity<?> getLogsStats() {
        // Check if user is admin
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Unauthorized");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        if (!"admin".equals(userDetails.getUsername())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied. Only admin can view stats.");
        }
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalLogs", apiLogService.getTotalLogs());
        stats.put("errorLogs", apiLogService.getErrorLogs());
        
        return ResponseEntity.ok(stats);
    }

    // DTO for admin login request
    public static class AdminLoginRequest {
        private String username;
        private String password;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }
}
