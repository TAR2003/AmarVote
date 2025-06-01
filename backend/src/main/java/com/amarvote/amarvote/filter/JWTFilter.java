package com.amarvote.amarvote.filter;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.amarvote.amarvote.service.JWTService;
import com.amarvote.amarvote.service.MyUserDetailsService;
import org.springframework.stereotype.Component;

@Component
public class JWTFilter extends OncePerRequestFilter {

    @Autowired
    private JWTService jwtService;

    @Autowired
    private MyUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String jwtToken = null;
        String userEmail = null;

        // Extract JWT from cookie named "token"
        Cookie[] cookies = request.getCookies();
        System.out.println("Cookies: " + (cookies != null ? cookies.length : "null"));
        
        

        if (cookies != null) {
            for (Cookie cookie : cookies) {
                System.out.println(cookie.getName());
                if ("jwtToken".equals(cookie.getName())) {
                    jwtToken = cookie.getValue();
                    break;
                }
            }
        }

        System.out.println("JWT Token: " + jwtToken);

        if (jwtToken != null) {
            try {
                userEmail = jwtService.extractUserEmailFromToken(jwtToken);
            } catch (Exception e) {
                logger.warn("Failed to extract user from JWT", e);
            }

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                if (jwtService.validateToken(jwtToken, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
