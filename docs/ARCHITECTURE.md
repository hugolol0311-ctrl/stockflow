# Arquitetura do StockFlow

## Fluxo de uma requisição

```text
Navegador ── cookie + CSRF ──► Spring Boot
                                 │
                     sessão com tokens Supabase
                                 │
                   JWT individual + chave publishable
                                 ▼
                   Supabase Auth / Data API
                                 │
                    PostgreSQL: RLS + funções
```

Controllers cuidam de HTTP e validação dos DTOs. `InventoryService` seleciona os recursos e funções disponíveis. `SupabaseClient` centraliza comunicação, timeouts e tradução de erros. As invariantes do estoque ficam nas funções PostgreSQL para que também sejam respeitadas se a Data API for chamada diretamente.

## Modelo de dados

- `categories`: identificação, dono da conta, nome e criação.
- `products`: identificação, dono, SKU, categoria opcional, descrição, preço, saldo, mínimo e datas.
- `movements`: produto, dono, tipo, quantidade, saldo posterior, motivo, chave de requisição e data. Nome e SKU são copiados no lançamento para preservar a informação histórica.

Cada tabela de negócio possui `user_id` associado a `auth.users`. O vínculo entre produto e categoria tem verificação de propriedade na função de escrita. A categoria é bloqueada para impedir remoção simultânea enquanto se cria um vínculo.

## Movimentação atômica

`move_stock` verifica autenticação, tipo e limites. Um bloqueio transacional por usuário/chave de requisição serializa reenvios idênticos. Uma chave existente retorna o lançamento original, desde que o conteúdo seja igual. A função bloqueia o produto com `FOR UPDATE`, calcula e valida o saldo, atualiza o produto e insere a movimentação. Qualquer erro desfaz tudo. Edições de metadados não alteram quantidade.

Duas saídas legítimas podem chegar juntas: o bloqueio da linha faz a segunda usar o saldo já atualizado pela primeira. A garantia deve ser validada com duas conexões independentes em um ambiente PostgreSQL/Supabase antes de ampliar uso de produção.

## Autenticação e segurança

- Senhas são enviadas ao Supabase Auth; o aplicativo não as armazena.
- Tokens de acesso e renovação ficam na sessão do Java. O identificador da sessão é renovado no login.
- Renovação de token é sincronizada por sessão, antes da expiração.
- Sessão Java expira após oito horas de inatividade. Logout tenta revogar a sessão no Supabase e sempre invalida a sessão local quando o endpoint é alcançado.
- `SessionGuard` exige sessão para a API, exceto login, cadastro e obtenção de CSRF. Spring Security mantém CSRF para todas as escritas.
- RLS protege leituras; funções `SECURITY DEFINER` usam caminho fixo e conferem propriedade. Execução é concedida somente a `authenticated`; nenhuma mutação direta de tabelas é concedida.
- CSP limita recursos à mesma origem e proíbe enquadramento. Conteúdo textual é escapado antes da renderização.
- Em HTTPS, configure o cookie como `Secure`. Não registre tokens, senhas ou cabeçalhos de autenticação.

## Decisões de escopo

Frontend sem framework para facilitar execução e leitura do código. O Spring serve os arquivos estáticos, evitando CORS e uma segunda implantação. Integração via Data API elimina a necessidade de credenciais administrativas do banco. O cliente lista páginas de até 500 registros; a interface pagina em blocos de 10.

Não há recuperação de senha, anexos, relatórios fiscais, compartilhamento de estoque, roles administrativas, múltiplos depósitos ou importação em massa. São evoluções possíveis, não funcionalidades prometidas desta entrega.
