package com.stockflow.inventory;
import com.fasterxml.jackson.databind.JsonNode;
import com.stockflow.auth.AuthService;
import com.stockflow.supabase.SupabaseClient;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
@Service
public class InventoryService {
 private final SupabaseClient client;
 private final AuthService auth;
 public InventoryService(SupabaseClient client,AuthService auth) { this.client=client; this.auth=auth; }
 public JsonNode list(String table,int offset,HttpSession session) {
  String filter=table.equals("products")?"&deleted_at=is.null":"";
  String order=table.equals("movements")?"created_at.desc,id.desc":"created_at.asc,id.asc";
  return client.request(HttpMethod.GET,"/rest/v1/"+table+"?select=*&order="+order+"&limit=500&offset="+Math.max(0,offset)+filter,auth.token(session),null);
 }
 public JsonNode rpc(String name,Object payload,HttpSession session) { return client.request(HttpMethod.POST,"/rest/v1/rpc/"+name,auth.token(session),payload); }
}
