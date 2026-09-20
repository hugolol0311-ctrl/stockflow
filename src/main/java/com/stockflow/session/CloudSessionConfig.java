package com.stockflow.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stockflow.supabase.SupabaseClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.session.config.annotation.web.http.EnableSpringHttpSession;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
@Profile("vercel")
@EnableSpringHttpSession
public class CloudSessionConfig {
 @Bean SupabaseSessionRepository sessionRepository(SupabaseClient client, ObjectMapper mapper,
   @Value("${stockflow.session-secret}") String secret) {
  return new SupabaseSessionRepository(client, mapper, secret);
 }
 @Bean DefaultCookieSerializer cookieSerializer() {
  var cookie = new DefaultCookieSerializer();
  cookie.setCookieName("__Host-STOCKFLOW");
  cookie.setCookiePath("/");
  cookie.setUseHttpOnlyCookie(true);
  cookie.setUseSecureCookie(true);
  cookie.setSameSite("Strict");
  return cookie;
 }
}
