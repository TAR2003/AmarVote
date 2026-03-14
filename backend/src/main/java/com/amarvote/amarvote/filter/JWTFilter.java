package com.amarvote.amarvote.filter;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.amarvote.amarvote.service.JWTService;
import com.amarvote.amarvote.service.MyUserDetailsService;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JWTFilter extends OncePerRequestFilter {

    @Autowired
    private JWTService jwtService;

    @Autowired
    private MyUserDetailsService userDetailsService;

    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        
        // Skip JWT processing for public routes
        if (isPublicRoute(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        String jwtToken = null;
        String userEmail = null;

        // First try to extract JWT from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwtToken = authHeader.substring(7);
        }

        // If not found in header, try cookie
        if (jwtToken == null) {
            Cookie[] cookies = request.getCookies();
            
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("jwtToken".equals(cookie.getName())) {
                        jwtToken = cookie.getValue();
                        break;
                    }
                }
            }
        }

        if (jwtToken != null) {
            try {
                userEmail = jwtService.extractUserEmailFromToken(jwtToken);
            } catch (ExpiredJwtException e) {
                logger.info("Expired JWT received for path " + requestPath);
                clearJwtCookie(response);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "JWT expired");
                return;
            } catch (JwtException e) {
                logger.info("Invalid JWT received for path " + requestPath);
                clearJwtCookie(response);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid JWT");
                return;
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
                    
                    // Store the original JWT token in request attributes for later use
                    request.setAttribute("jwtToken", jwtToken);
                    request.setAttribute("userEmail", userEmail);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private void clearJwtCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwtToken", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }
    
    private boolean isPublicRoute(String requestPath) {
        String[] publicPaths = {
            "/api/auth/register",
            "/api/auth/login", 
            "/api/auth/firebase-login",
            "/api/password/forgot-password",
            "/api/password/create-password",
            "/api/verify/send-code",
            "/api/verify/verify-code",
            "/api/test-deepseek",
            "/api/health",
            "/api/chatbot/",
            "/api/admin/login"
        };
        
        for (String path : publicPaths) {
            if (requestPath.startsWith(path)) {
                return true;
            }
        }
        return false;
    }
}
