package com.stockflow;

import com.fasterxml.jackson.databind.*;
import com.stockflow.auth.AuthSession;
import com.stockflow.session.*;
import com.stockflow.supabase.SupabaseClient;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CloudSessionsTest {
 static final String SECRET=Base64.getEncoder().encodeToString(new byte[32]);
 final ObjectMapper mapper=new ObjectMapper();
 final Map<String,JsonNode> database=new HashMap<>();
 SupabaseClient client;
 SupabaseSessionRepository repository;
 @BeforeEach void setup() {
  client=mock(SupabaseClient.class);
  when(client.request(eq(HttpMethod.POST),eq("/rest/v1/rpc/stockflow_session"),isNull(),any())).thenAnswer(invocation->{
   Map<String,Object> payload=invocation.getArgument(3);String id=(String)payload.get("p_id");
   switch((String)payload.get("p_action")) {
    case "get":return database.get(id);
    case "delete":database.remove(id);return mapper.createObjectNode();
    case "save":
     String old=(String)payload.get("p_old_id");
     JsonNode previous=old==null?database.get(id):database.remove(old);
     if(previous==null&&!Boolean.TRUE.equals(payload.get("p_new")))return null;
     var attrs=previous==null?mapper.createObjectNode():previous.path("attributes").deepCopy();
     ((com.fasterxml.jackson.databind.node.ObjectNode)attrs).setAll((com.fasterxml.jackson.databind.node.ObjectNode)mapper.valueToTree(payload.get("p_attributes")));
     for(String removed:(List<String>)payload.get("p_removed"))((com.fasterxml.jackson.databind.node.ObjectNode)attrs).remove(removed);
     var node=mapper.createObjectNode();node.put("created_at",(String)payload.get("p_created_at"));node.put("last_accessed_at",(String)payload.get("p_accessed_at"));node.set("attributes",attrs);database.put(id,node);return mapper.createObjectNode();
    default:throw new AssertionError("Unknown action");
   }
  });
  repository=new SupabaseSessionRepository(client,mapper,SECRET);
 }
 @Test void encryptedSessionsSurviveRepositoryRestart() throws Exception {
  var s=repository.createSession();s.setAttribute("csrf",new DefaultCsrfToken("X-CSRF-TOKEN","_csrf","csrf-private-value"));
  s.setAttribute(AuthSession.KEY,new AuthSession(mapper.readTree("{\"access_token\":\"private-access\",\"refresh_token\":\"private-refresh\",\"expires_in\":3600,\"user\":{\"email\":\"demo@example.com\"}}")));
  repository.save(s);assertFalse(database.get(s.getId()).toString().contains("private-access"));assertFalse(database.get(s.getId()).toString().contains("csrf-private-value"));
  var restarted=new SupabaseSessionRepository(client,mapper,SECRET);var restored=restarted.findById(s.getId());
  assertEquals("private-access",((AuthSession)restored.getAttribute(AuthSession.KEY)).token());
  assertEquals("csrf-private-value",((DefaultCsrfToken)restored.getAttribute("csrf")).getToken());
 }
 @Test void parallelReadDoesNotOverwriteChangedAttributes() {
  var s=repository.createSession();s.setAttribute("csrf",new DefaultCsrfToken("X","c","old"));repository.save(s);
  var a=repository.findById(s.getId());var b=repository.findById(s.getId());
  a.setAttribute("csrf",new DefaultCsrfToken("X","c","new"));repository.save(a);repository.save(b);
  assertEquals("new",((DefaultCsrfToken)repository.findById(s.getId()).getAttribute("csrf")).getToken());
 }
 @Test void inFlightRequestCannotResurrectLogout() {
  var s=repository.createSession();repository.save(s);var inFlight=repository.findById(s.getId());repository.deleteById(s.getId());repository.save(inFlight);assertNull(repository.findById(s.getId()));
 }
 @Test void sessionRotationInvalidatesOldIdentifier() {
  var s=repository.createSession();repository.save(s);String old=s.getId();s.changeSessionId();repository.save(s);assertNull(repository.findById(old));assertNotNull(repository.findById(s.getId()));
 }
 @Test void expiredAndInvalidSessionsAreRejected() {
  assertNull(repository.findById("invalid-cookie"));var s=repository.createSession();s.setLastAccessedTime(Instant.now().minusSeconds(30000));repository.save(s);assertNull(repository.findById(s.getId()));
 }
 @Test void ciphertextTamperingAndWrongKeysAreRejected() {
  var cipher=new SessionCipher(SECRET);String encrypted=cipher.encrypt("private data");assertEquals("private data",cipher.decrypt(encrypted));
  byte[] bytes=Base64.getDecoder().decode(encrypted);bytes[15]^=1;assertThrows(IllegalArgumentException.class,()->cipher.decrypt(Base64.getEncoder().encodeToString(bytes)));
  byte[] other=new byte[32];Arrays.fill(other,(byte)1);assertThrows(IllegalArgumentException.class,()->new SessionCipher(Base64.getEncoder().encodeToString(other)).decrypt(encrypted));
 }
}
