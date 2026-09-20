package com.stockflow.supabase;
import com.fasterxml.jackson.databind.JsonNode;
import com.stockflow.shared.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.net.http.HttpClient;
import java.time.Duration;
@Component
public class SupabaseClient {
 private final RestClient client;
 public SupabaseClient(@Value("${supabase.url}") String url,@Value("${supabase.key}") String key) {
  if(!url.startsWith("https://") && !url.startsWith("http://localhost:") && !url.startsWith("http://127.0.0.1:")) throw new IllegalArgumentException("SUPABASE_URL deve usar HTTPS.");
  var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
  factory.setReadTimeout(Duration.ofSeconds(20));
  client=RestClient.builder().baseUrl(url).defaultHeader("apikey",key).requestFactory(factory).build();
 }
 public JsonNode request(HttpMethod method,String path,String token,Object body) {
  try {
   var req=client.method(method).uri(path).contentType(MediaType.APPLICATION_JSON);
   if(token!=null) req.header("Authorization","Bearer "+token);
   if(body!=null) req.body(body);
   return req.retrieve().body(JsonNode.class);
  } catch(RestClientResponseException e) {
   String raw=e.getResponseBodyAsString();
   if(e.getStatusCode().value()==429) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Muitas tentativas. Aguarde um pouco antes de tentar novamente.");
   if(e.getStatusCode().value()==401) throw new ApiException(HttpStatus.UNAUTHORIZED,"Sessão expirada ou credenciais inválidas. Entre novamente.");
   if(raw.contains("INSUFFICIENT_STOCK")) throw new ApiException(HttpStatus.CONFLICT,"Saldo insuficiente para esta saída.");
   if(raw.contains("23505")) throw new ApiException(HttpStatus.CONFLICT,"Já existe um produto com este SKU ou uma categoria com este nome.");
   if(raw.contains("CATEGORY_IN_USE")) throw new ApiException(HttpStatus.CONFLICT,"Esta categoria possui produtos vinculados.");
   if(raw.contains("PRODUCT_HAS_STOCK")) throw new ApiException(HttpStatus.CONFLICT,"Zere o estoque com uma saída antes de excluir o produto.");
   if(raw.contains("NOT_FOUND")) throw new ApiException(HttpStatus.NOT_FOUND,"Registro não encontrado.");
   if(raw.contains("INVALID_")) throw new ApiException(HttpStatus.BAD_REQUEST,"Revise os dados informados.");
   if(path.startsWith("/auth/")) throw new ApiException(HttpStatus.BAD_REQUEST,"Não foi possível autenticar. Confira seus dados e a confirmação do e-mail.");
   throw new ApiException(HttpStatus.BAD_GATEWAY,"O banco recusou a operação. Confira a configuração ou tente novamente.");
  } catch(ResourceAccessException e) { throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Supabase indisponível. Tente novamente em instantes."); }
 }
}
