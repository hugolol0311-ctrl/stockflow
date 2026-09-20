package com.stockflow.auth;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.Serializable;
public class AuthSession implements Serializable {
 public static final String KEY="stockflow.auth";
 private String accessToken,refreshToken;
 private long expiresAt;
 private final String email;
 public AuthSession(JsonNode json) { email=json.path("user").path("email").asText(); update(json); }
 public synchronized void update(JsonNode json) { accessToken=json.path("access_token").asText(); refreshToken=json.path("refresh_token").asText(); expiresAt=System.currentTimeMillis()+json.path("expires_in").asLong(3600)*1000; }
 public String token() { return accessToken; }
 public String refresh() { return refreshToken; }
 public boolean expiring() { return System.currentTimeMillis()>expiresAt-60000; }
 public synchronized java.util.Map<String,Object> snapshot() { return java.util.Map.of("access_token",accessToken,"refresh_token",refreshToken,"expires_at",expiresAt,"email",email); }
 public static AuthSession restore(JsonNode json) {
  var tree=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
  tree.put("access_token",json.path("access_token").asText()); tree.put("refresh_token",json.path("refresh_token").asText());
  tree.putObject("user").put("email",json.path("email").asText());
  var auth=new AuthSession(tree);auth.expiresAt=json.path("expires_at").asLong();return auth;
 }
 public String email() { return email; }
}
