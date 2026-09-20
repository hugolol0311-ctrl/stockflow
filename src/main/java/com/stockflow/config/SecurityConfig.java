package com.stockflow.config;
import com.stockflow.auth.AuthSession;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
@Configuration
public class SecurityConfig {
 @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
  http.authorizeHttpRequests(a -> a.anyRequest().permitAll())
   .formLogin(f -> f.disable()).httpBasic(b -> b.disable()).logout(l -> l.disable())
   .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")))
   .addFilterBefore(new SessionGuard(), AuthorizationFilter.class);
  // CSRF remains enabled, including login and logout. Tokens are fetched from /api/auth/csrf.
  return http.build();
 }
 static class SessionGuard extends OncePerRequestFilter {
  @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
   String path=request.getServletPath();
   if(path.startsWith("/api/") && !path.equals("/api/auth/login") && !path.equals("/api/auth/signup") && !path.equals("/api/auth/csrf")) {
    HttpSession session=request.getSession(false);
    if(session==null || !(session.getAttribute(AuthSession.KEY) instanceof AuthSession)) {
     response.setStatus(401); response.setContentType("application/json"); response.getWriter().write("{\"message\":\"Entre na sua conta para continuar.\"}"); return;
    }
   }
   if(path.startsWith("/api/")) response.setHeader("Cache-Control","no-store");
   chain.doFilter(request,response);
  }
 }
}
