package com.stockflow.auth;
import com.stockflow.supabase.SupabaseClient;
import com.stockflow.shared.ApiException;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequestMapping("/api/auth")
public class AuthController {
 private final SupabaseClient client;
 private final AuthService authService;
 public AuthController(SupabaseClient client,AuthService authService) { this.client=client; this.authService=authService; }
 public record Credentials(@NotBlank @Email @Size(max=254) String email,@NotBlank @Size(min=8,max=128) String password) {}
 @GetMapping("/csrf") public Map<String,String> csrf(CsrfToken token) { return Map.of("token",token.getToken(),"headerName",token.getHeaderName()); }
 @PostMapping("/login") public Map<String,String> login(@Valid @RequestBody Credentials credentials,HttpServletRequest request) {
  var result=client.request(HttpMethod.POST,"/auth/v1/token?grant_type=password",null,credentials);
  if(result==null || !result.hasNonNull("access_token")) throw new ApiException(HttpStatus.UNAUTHORIZED,"Não foi possível iniciar a sessão.");
  request.getSession(); request.changeSessionId();
  var auth=new AuthSession(result); request.getSession().setAttribute(AuthSession.KEY,auth);
  return Map.of("email",auth.email());
 }
 @PostMapping("/signup") public Map<String,String> signup(@Valid @RequestBody Credentials credentials) {
  client.request(HttpMethod.POST,"/auth/v1/signup",null,credentials);
  return Map.of("message","Se o cadastro puder ser realizado, você receberá um e-mail de confirmação. Depois, entre na sua conta.");
 }
 @GetMapping("/me") public Map<String,String> me(HttpSession session) {
  authService.token(session); return Map.of("email",((AuthSession)session.getAttribute(AuthSession.KEY)).email());
 }
 @PostMapping("/logout") public Map<String,String> logout(HttpSession session) {
  boolean revoked=true;
  try { client.request(HttpMethod.POST,"/auth/v1/logout?scope=local",authService.token(session),null); }
  catch(ApiException e) { revoked=false; }
  finally { try { session.invalidate(); } catch(IllegalStateException ignored) {} }
  return Map.of("message",revoked?"Você saiu da sua conta.":"Sessão local encerrada. Não foi possível confirmar a revogação no Supabase.");
 }
}
