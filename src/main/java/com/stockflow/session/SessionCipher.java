package com.stockflow.session;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;

/** Authenticated encryption; only encrypted session attributes are stored in PostgreSQL. */
public final class SessionCipher {
 private final SecretKeySpec key;
 private final SecureRandom random = new SecureRandom();
 public SessionCipher(String secret) {
  if (Base64.getDecoder().decode(secret).length < 32) throw new IllegalArgumentException("SESSION_STORE_SECRET precisa de 32 bytes aleatórios em base64.");
  try {
   key = new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(("stockflow-session-v1:"+secret).getBytes(StandardCharsets.UTF_8)), "AES");
  } catch (GeneralSecurityException e) { throw new IllegalStateException(e); }
 }
 public String encrypt(String plaintext) {
  try {
   byte[] iv = new byte[12];random.nextBytes(iv);
   var cipher = Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,iv));
   byte[] encrypted=cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
   byte[] result=Arrays.copyOf(iv,iv.length+encrypted.length);System.arraycopy(encrypted,0,result,iv.length,encrypted.length);
   return Base64.getEncoder().encodeToString(result);
  } catch (GeneralSecurityException e) { throw new IllegalStateException("Falha ao proteger sessão.",e); }
 }
 public String decrypt(String encoded) {
  try {
   byte[] bytes=Base64.getDecoder().decode(encoded);
   if(bytes.length<28)throw new IllegalArgumentException("Sessão inválida.");
   var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,bytes,0,12));
   return new String(cipher.doFinal(bytes,12,bytes.length-12),StandardCharsets.UTF_8);
  } catch (GeneralSecurityException|IllegalArgumentException e) { throw new IllegalArgumentException("Sessão inválida.",e); }
 }
}
