package com.stockflow.inventory;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.*;
@RestController @RequestMapping("/api")
public class InventoryController {
 private final InventoryService service;
 public InventoryController(InventoryService service) { this.service=service; }
 public record Product(UUID id,@NotBlank @Size(max=120) String name,@NotBlank @Size(max=40) String sku,UUID category_id,@NotNull @DecimalMin("0") @DecimalMax("999999999.99") @Digits(integer=9,fraction=2) BigDecimal price,@Min(0) @Max(1000000000) int min_stock,@Size(max=1000) String description) {}
 public record Category(UUID id,@NotBlank @Size(max=80) String name) {}
 public record Movement(@NotNull UUID product_id,@NotBlank @Pattern(regexp="IN|OUT") String type,@Min(1) @Max(1000000000) int quantity,@NotBlank @Size(max=500) String reason,@NotNull UUID request_id) {}
 @GetMapping("/products") public JsonNode products(@RequestParam(defaultValue="0") int offset,HttpSession s) { return service.list("products",offset,s); }
 @GetMapping("/categories") public JsonNode categories(@RequestParam(defaultValue="0") int offset,HttpSession s) { return service.list("categories",offset,s); }
 @GetMapping("/movements") public JsonNode movements(@RequestParam(defaultValue="0") int offset,HttpSession s) { return service.list("movements",offset,s); }
 @PostMapping("/products") public JsonNode save(@Valid @RequestBody Product p,HttpSession s) { return service.rpc("save_product",Map.of("payload",p),s); }
 @DeleteMapping("/products/{id}") public JsonNode delete(@PathVariable UUID id,HttpSession s) { return service.rpc("delete_product",Map.of("p_id",id),s); }
 @PostMapping("/categories") public JsonNode category(@Valid @RequestBody Category c,HttpSession s) { return service.rpc("save_category",Map.of("payload",c),s); }
 @DeleteMapping("/categories/{id}") public JsonNode deleteCategory(@PathVariable UUID id,HttpSession s) { return service.rpc("delete_category",Map.of("p_id",id),s); }
 @PostMapping("/movements") public JsonNode move(@Valid @RequestBody Movement m,HttpSession s) { return service.rpc("move_stock",Map.of("payload",m),s); }
}
