# GitHub e Vercel

O backend Java é publicado como contêiner usando `Dockerfile.vercel`. A Vercel oferece Container Images em beta. O perfil `vercel` usa sessões compartilhadas, com atributos criptografados no Supabase, e cookies seguros.

## Preparação obrigatória

1. Execute `supabase/migrations/002_cloud_sessions.sql` no Supabase após a migração 001.
2. Gere um segredo aleatório de 32 bytes em base64. Salve-o apenas no gerenciador de variáveis da Vercel como `SESSION_STORE_SECRET`.
3. Calcule o SHA-256 da string base64 (sem quebra de linha) e registre **somente o hash**:

```sql
insert into stockflow_private.runtime_config(id, secret_sha256)
values (1, 'HASH_SHA256_DO_SEGREDO')
on conflict (id) do update set secret_sha256 = excluded.secret_sha256;
```

A troca do segredo invalida as sessões existentes. O schema privado não deve ser exposto na Data API. As funções de armazenamento conferem esse segredo antes de qualquer operação.

## Implantação

Importe o repositório na Vercel. Use a raiz do repositório, sem preset de framework. O arquivo `Dockerfile.vercel` é detectado automaticamente. Configure:

- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_ANON_KEY`: chave publishable/anon.
- `SESSION_STORE_SECRET`: segredo do passo anterior.
- `PORT`: `8080`.
- `SPRING_PROFILES_ACTIVE`: `vercel`.
- `COOKIE_SECURE`: `true`.

Não envie `.env` para o GitHub nem para o contexto de build. Após publicar, configure o domínio HTTPS gerado como Site URL no Supabase e adicione-o aos redirecionamentos permitidos. Preserve `http://localhost:8080` se também usar a instalação local.

## Verificação

Abra `/api/auth/csrf`: deve retornar HTTP 200 e criar um cookie seguro. Sem login, `/api/products` deve retornar 401. Cadastre sua conta, confirme o e-mail e teste uma entrada e uma saída. Para cadastros públicos, configure SMTP próprio no Supabase.

A compilação e os testes Java incluem criptografia, restauração de sessão em nova instância, rotação do identificador, alterações concorrentes e invalidação no logout. A implantação e a migração 002 precisam estar concluídas para usar o perfil `vercel`.
