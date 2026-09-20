# Validação da entrega

Verificação local em 19/09/2026.

## Executado com sucesso

- `mvn verify`: compilação, empacotamento e **8 testes Java** aprovados.
- `node --check src/main/resources/static/app.js`: sintaxe válida.
- `npm run test:db`: **7 testes PostgreSQL/PGlite** aprovados usando a migração real.
- Aplicação Java executada e inspecionada no navegador: login, dashboard, criação de categoria, criação e edição de produto, busca por SKU, entrada de 10 unidades, rejeição de saída de 11, saída de 6 com alerta de mínimo, filtro de saídas no histórico, rejeição de exclusão com saldo, saída das 4 unidades restantes, exclusão lógica com três movimentos preservados e logout.
- Layout de dashboard inspecionado em desktop de 1440 px e celular de 390 px; sem transbordamento horizontal do documento. Tabelas têm rolagem própria.
- Capturas de tela obtidas do aplicativo real com dados fictícios locais.

## Limites desta verificação

A integração de navegador usou um servidor local de teste que simula Auth e Data API, respaldado por PostgreSQL/PGlite. Nenhuma conta, chave ou projeto Supabase real foi utilizado. Envio de e-mail, confirmação de cadastro, políticas da plataforma e implantação externa precisam de validação após configuração do projeto real.

A suíte Playwright está incluída, mas seu lançador de Chrome foi bloqueado pelo ambiente local (falha ao iniciar o processo). Os fluxos acima foram verificados pelo navegador integrado. Não se declara a suíte Playwright como aprovada.

PGlite serializa transações em uma conexão. Os testes validam as regras e os resultados de requisições repetidas, mas não medem concorrência real entre múltiplas conexões. Em homologação, envie duas saídas concorrentes contra um saldo que só atende uma e confirme uma operação aceita, uma recusada e saldo coerente.

## Checagem no seu Supabase

1. Execute a migração em um projeto de desenvolvimento e configure `.env`.
2. Cadastre duas contas com e-mails diferentes e confirme os e-mails.
3. Na conta A, crie produto, categoria e entrada.
4. Entre na conta B: as listas devem estar vazias; tentar IDs da conta A pela API deve falhar.
5. Na conta A, teste uma saída válida e outra acima do saldo.
6. Confirme o histórico, a renovação de sessão e logout.
7. Em produção, confira HTTPS, `COOKIE_SECURE=true` e Site URL correta.

## Atualização: configuração no Supabase real

Posteriormente, o projeto StockFlow foi criado e configurado no Supabase. A migração, as permissões, as regras de saldo/idempotência e o isolamento entre contas foram verificados no banco real com transação revertida. O endpoint de autenticação respondeu HTTP 200 e a leitura anônima de produtos foi recusada. Veja [SUPABASE-CONFIGURADO.md](SUPABASE-CONFIGURADO.md). Envio/recebimento de e-mail e primeiro login do usuário ainda dependem de cadastro pelo próprio usuário.
