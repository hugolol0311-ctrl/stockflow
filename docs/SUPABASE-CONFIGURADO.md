# Supabase configurado

Configuração concluída em 19/09/2026 no projeto **StockFlow**, separado do projeto anterior.

- Migração `001_stockflow.sql` aplicada com sucesso.
- Tabelas `products`, `categories` e `movements` criadas.
- RLS habilitada nas três tabelas; leitura anônima e escrita direta bloqueadas.
- Cadastro e login por e-mail habilitados; confirmação de e-mail obrigatória.
- Site URL e redirecionamento configurados para `http://localhost:8080`.
- Conexão salva apenas no `.env` local, com permissão de leitura e escrita somente para seu usuário. `.env` não integra o ZIP nem o repositório.
- Chave publishable utilizada; nenhuma chave administrativa ou senha do banco utilizada pelo aplicativo.

## Verificação real

A API de autenticação respondeu com sucesso e o acesso anônimo aos produtos foi recusado. As operações de entrada e saída, bloqueio de saldo negativo, idempotência e isolamento entre duas contas foram verificadas diretamente no PostgreSQL do Supabase. O teste foi executado em uma transação revertida; não deixou usuários ou produtos de teste.

A aplicação Java respondeu em `http://localhost:8080`; as rotas protegidas recusaram acesso sem login. Para começar, abra o aplicativo, clique em **Cadastre-se** e confirme seu e-mail. A confirmação por e-mail e o primeiro login com sua conta ainda dependem desse cadastro.

O projeto utiliza o serviço de e-mail padrão do Supabase, sujeito às restrições de destinatários e limites da plataforma. Para uma demonstração pública com cadastro de clientes, configure um provedor SMTP próprio.

## Reabrir neste computador

Execute `iniciar.command` na pasta do projeto. Ele usa o Java e o pacote já preparados neste ambiente. Em outra máquina, siga o README para instalar Java/Maven ou usar Docker e configure um novo `.env`.

A configuração atual é para uso local. Para publicar o sistema, configure o endereço HTTPS definitivo no Supabase e ative `COOKIE_SECURE=true`.
