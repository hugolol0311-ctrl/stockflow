package com.stockflow.session;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stockflow.auth.AuthSession;
import com.stockflow.supabase.SupabaseClient;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.csrf.*;
import org.springframework.session.*;
import java.time.*;
import java.util.*;

/** Shared, encrypted sessions for horizontally scaled/container deployments. */
public class SupabaseSessionRepository implements SessionRepository<SupabaseSessionRepository.StoredSession> {
 private final SupabaseClient client;
 private final ObjectMapper mapper;
 private final String secret;
 private final SessionCipher cipher;
 public SupabaseSessionRepository(SupabaseClient client,ObjectMapper mapper,String secret) {
  this.client=client;this.mapper=mapper;this.secret=secret;this.cipher=new SessionCipher(secret);
 }
 public static class StoredSession implements Session {
  private final MapSession delegate;
  String persistedId;
  boolean fresh;
  final Map<String,JsonNode> original=new HashMap<>();
  StoredSession() { delegate=new MapSession();fresh=true;setMaxInactiveInterval(Duration.ofHours(8)); }
  StoredSession(String id) { delegate=new MapSession(id);persistedId=id; }
  public String getId() { return delegate.getId(); }
  public String changeSessionId() { return delegate.changeSessionId(); }
  public <T> T getAttribute(String name) { return delegate.getAttribute(name); }
  public Set<String> getAttributeNames() { return delegate.getAttributeNames(); }
  public void setAttribute(String name,Object value) { delegate.setAttribute(name,value); }
  public void removeAttribute(String name) { delegate.removeAttribute(name); }
  public Instant getCreationTime() { return delegate.getCreationTime(); }
  public void setCreationTime(Instant value) { delegate.setCreationTime(value); }
  public Instant getLastAccessedTime() { return delegate.getLastAccessedTime(); }
  public void setLastAccessedTime(Instant value) { delegate.setLastAccessedTime(value); }
  public Duration getMaxInactiveInterval() { return delegate.getMaxInactiveInterval(); }
  public void setMaxInactiveInterval(Duration value) { delegate.setMaxInactiveInterval(value); }
  public boolean isExpired() { return delegate.isExpired(); }
 }
 @Override public StoredSession createSession() { return new StoredSession(); }
 private JsonNode call(String action,String id,Map<String,Object> extra) {
  var payload=new HashMap<String,Object>(extra);payload.put("p_secret",secret);payload.put("p_action",action);payload.put("p_id",id);
  return client.request(HttpMethod.POST,"/rest/v1/rpc/stockflow_session",null,payload);
 }
 private ObjectNode encode(Object value) {
  if(value instanceof AuthSession auth) {
   var node=mapper.valueToTree(auth.snapshot());var wrapped=mapper.createObjectNode();wrapped.put("kind","auth");wrapped.set("value",node);return wrapped;
  }
  if(value instanceof CsrfToken csrf) return mapper.createObjectNode().put("kind","csrf").put("header",csrf.getHeaderName()).put("parameter",csrf.getParameterName()).put("token",csrf.getToken());
  throw new IllegalArgumentException("Tipo de atributo de sessão não suportado.");
 }
 private Object decode(JsonNode node) {
  return switch(node.path("kind").asText()) {
   case "auth" -> AuthSession.restore(node.path("value"));
   case "csrf" -> new DefaultCsrfToken(node.path("header").asText(),node.path("parameter").asText(),node.path("token").asText());
   default -> throw new IllegalArgumentException("Atributo de sessão inválido.");
  };
 }
 @Override public StoredSession findById(String id) {
  try { UUID.fromString(id); } catch(IllegalArgumentException e) { return null; }
  var json=call("get",id,Map.of());if(json==null||json.isNull())return null;
  var session=new StoredSession(id);
  session.setCreationTime(Instant.parse(json.path("created_at").asText()));
  session.setLastAccessedTime(Instant.parse(json.path("last_accessed_at").asText()));
  session.setMaxInactiveInterval(Duration.ofHours(8));
  if(session.isExpired())return null;
  try {
   var fields=json.path("attributes").fields();
   while(fields.hasNext()) {
    var entry=fields.next();var plain=mapper.readTree(cipher.decrypt(entry.getValue().asText()));
    session.setAttribute(entry.getKey(),decode(plain));session.original.put(entry.getKey(),plain);
   }
   return session;
  } catch(Exception e) { deleteById(id);return null; }
 }
 @Override public void save(StoredSession session) {
  var delta=new HashMap<String,String>();var current=new HashMap<String,JsonNode>();
  for(String name:session.getAttributeNames()) {
   var plain=encode(session.getAttribute(name));current.put(name,plain);
   if(!plain.equals(session.original.get(name)))delta.put(name,cipher.encrypt(plain.toString()));
  }
  var removed=new ArrayList<>(session.original.keySet());removed.removeAll(session.getAttributeNames());
  var extra=new HashMap<String,Object>();extra.put("p_new",session.fresh);extra.put("p_attributes",delta);extra.put("p_removed",removed);
  extra.put("p_created_at",session.getCreationTime().toString());extra.put("p_accessed_at",session.getLastAccessedTime().toString());
  if(session.persistedId!=null&&!session.persistedId.equals(session.getId()))extra.put("p_old_id",session.persistedId);
  // The database refuses to recreate sessions invalidated by a concurrent logout.
  call("save",session.getId(),extra);
  session.fresh=false;session.persistedId=session.getId();session.original.clear();session.original.putAll(current);
 }
 @Override public void deleteById(String id) { call("delete",id,Map.of()); }
}
