package com.stockflow.shared;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;
@RestControllerAdvice
public class ApiErrors {
 @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e) { return ResponseEntity.status(e.status()).body(Map.of("message",e.getMessage())); }
 @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
 ResponseEntity<?> invalid(Exception e) { return ResponseEntity.badRequest().body(Map.of("message","Revise os campos: valores e formatos inválidos.")); }
 @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e) { return ResponseEntity.internalServerError().body(Map.of("message","Não foi possível concluir a operação. Tente novamente.")); }
}
