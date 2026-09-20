package com.stockflow.auth;
import com.stockflow.supabase.SupabaseClient;
import com.stockflow.shared.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.http.*;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
@Service
public class AuthService {
 private final SupabaseClient client;
 public AuthService(SupabaseClient client) { this.client=client; }
 public String token(HttpSession session) {
  if(!(session.getAttribute(AuthSession.KEY) instanceof AuthSession auth)) throw new ApiException(HttpStatus.UNAUTHORIZED,"Entre novamente.");
  synchronized(auth) {
   if(auth.expiring()) {
    try { auth.update(client.request(HttpMethod.POST,"/auth/v1/token?grant_type=refresh_token",null,Map.of("refresh_token",auth.refresh()))); }
    catch(ApiException e) { if(e.status().is4xxClientError()) { session.invalidate(); throw new ApiException(HttpStatus.UNAUTHORIZED,"Sessão expirada. Entre novamente."); } throw e; }
   }
   return auth.token();
  }
 }
}
