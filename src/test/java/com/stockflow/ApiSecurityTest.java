package com.stockflow;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stockflow.auth.AuthSession;
import com.stockflow.supabase.SupabaseClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.HttpMethod;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties={"supabase.url=http://localhost:9999","supabase.key=test-placeholder"})
@AutoConfigureMockMvc
class ApiSecurityTest {
 @Autowired MockMvc mvc;
 @Autowired ObjectMapper mapper;
 @MockitoBean SupabaseClient client;
 MockHttpSession session() throws Exception {
  var s=new MockHttpSession();s.setAttribute(AuthSession.KEY,new AuthSession(mapper.readTree("{\"access_token\":\"test-access\",\"refresh_token\":\"test-refresh\",\"expires_in\":3600,\"user\":{\"email\":\"test@example.com\"}}")));return s;
 }
 @Test void publicPageAndCsrfAreAvailable() throws Exception {
  mvc.perform(get("/")).andExpect(status().isOk()).andExpect(header().string("Content-Security-Policy",org.hamcrest.Matchers.containsString("frame-ancestors 'none'")));
  mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
 }
 @Test void anonymousInventoryIsBlocked() throws Exception {
  for(String path:new String[]{"/api/products","/api/categories","/api/movements","/api/auth/me"}) mvc.perform(get(path)).andExpect(status().isUnauthorized());
  verifyNoInteractions(client);
 }
 @Test void loginAndMutationsRequireCsrf() throws Exception {
  mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\"a@b.com\",\"password\":\"password123\"}")).andExpect(status().isForbidden());
  mvc.perform(delete("/api/products/11111111-1111-1111-1111-111111111111").session(session())).andExpect(status().isForbidden());
  verifyNoInteractions(client);
 }
 @Test void validatesNegativeMovementAndInvalidProductPrice() throws Exception {
  mvc.perform(post("/api/movements").session(session()).with(csrf()).contentType("application/json").content("{\"product_id\":\"11111111-1111-1111-1111-111111111111\",\"request_id\":\"22222222-2222-2222-2222-222222222222\",\"type\":\"OUT\",\"quantity\":-1,\"reason\":\"Venda\"}")).andExpect(status().isBadRequest());
  mvc.perform(post("/api/products").session(session()).with(csrf()).contentType("application/json").content("{\"name\":\"Café\",\"sku\":\"CAF\",\"price\":1.111,\"min_stock\":0}")).andExpect(status().isBadRequest());
  verifyNoInteractions(client);
 }
 @Test void passesUserTokenAndPaginates() throws Exception {
  when(client.request(eq(HttpMethod.GET),contains("/rest/v1/products"),eq("test-access"),isNull())).thenReturn(mapper.readTree("[]"));
  mvc.perform(get("/api/products?offset=500").session(session())).andExpect(status().isOk()).andExpect(content().json("[]"));
  verify(client).request(eq(HttpMethod.GET),contains("offset=500&deleted_at=is.null"),eq("test-access"),isNull());
 }
 @Test void logoutInvalidatesLocalSessionEvenWhenSupabaseIsDown() throws Exception {
  var s=session();when(client.request(eq(HttpMethod.POST),contains("/logout"),anyString(),isNull())).thenThrow(new com.stockflow.shared.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Unavailable"));
  mvc.perform(post("/api/auth/logout").session(s).with(csrf())).andExpect(status().isOk());assertTrue(s.isInvalid());
 }
 @Test void loginStoresTokensOnlyOnServerAndRotatesSession() throws Exception {
  when(client.request(eq(HttpMethod.POST),contains("grant_type=password"),isNull(),any())).thenReturn(mapper.readTree("{\"access_token\":\"private-token\",\"refresh_token\":\"private-refresh\",\"expires_in\":3600,\"user\":{\"email\":\"test@example.com\"}}"));
  var s=new MockHttpSession();String before=s.getId();
  mvc.perform(post("/api/auth/login").session(s).with(csrf()).contentType("application/json").content("{\"email\":\"test@example.com\",\"password\":\"password123\"}"))
   .andExpect(status().isOk()).andExpect(content().json("{\"email\":\"test@example.com\"}")).andExpect(jsonPath("$.access_token").doesNotExist());
  assertNotEquals(before,s.getId());assertInstanceOf(AuthSession.class,s.getAttribute(AuthSession.KEY));
 }
 @Test void expiredAccessTokenIsRefreshed() throws Exception {
  var s=new MockHttpSession();s.setAttribute(AuthSession.KEY,new AuthSession(mapper.readTree("{\"access_token\":\"old\",\"refresh_token\":\"refresh\",\"expires_in\":0,\"user\":{\"email\":\"test@example.com\"}}")));
  when(client.request(eq(HttpMethod.POST),contains("grant_type=refresh_token"),isNull(),any())).thenReturn(mapper.readTree("{\"access_token\":\"new\",\"refresh_token\":\"new-refresh\",\"expires_in\":3600}"));
  mvc.perform(get("/api/auth/me").session(s)).andExpect(status().isOk());assertEquals("new",((AuthSession)s.getAttribute(AuthSession.KEY)).token());
 }
}
