# API HTTP

Base: `/api`, na mesma origem da interface. Respostas JSON. Endpoints protegidos exigem o cookie de sessão. Antes de uma escrita, faça `GET /api/auth/csrf`, preserve o cookie e envie o valor de `token` no cabeçalho indicado por `headerName`. Não use JWT do Supabase diretamente na API Java.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/auth/csrf` | Obter token CSRF |
| POST | `/auth/signup` | Cadastrar com `email`, `password` |
| POST | `/auth/login` | Entrar com `email`, `password` |
| GET | `/auth/me` | E-mail da conta autenticada |
| POST | `/auth/logout` | Encerrar sessão |
| GET | `/products?offset=0` | Produtos ativos, até 500 por página |
| POST | `/products` | Criar (`id: null`) ou editar |
| DELETE | `/products/{id}` | Excluir produto com saldo zero |
| GET | `/categories?offset=0` | Categorias, até 500 por página |
| POST | `/categories` | Criar ou editar |
| DELETE | `/categories/{id}` | Excluir categoria sem vínculos |
| GET | `/movements?offset=0` | Histórico decrescente, até 500 por página |
| POST | `/movements` | Registrar entrada ou saída |

## Produto

```json
{
  "id": null,
  "name": "Café especial 250g",
  "sku": "CAF-001",
  "category_id": null,
  "price": 29.90,
  "min_stock": 10,
  "description": "Torra média"
}
```

Para editar, informe um UUID existente. Não existe campo para alterar saldo por este endpoint. Categoria é opcional. Preço aceita de zero a 999.999.999,99; mínimo de zero a 1.000.000.000 unidades. Nomes até 120 caracteres, SKU até 40, descrição até 1.000.

## Categoria

```json
{"id": null, "name": "Alimentos e bebidas"}
```

Nome obrigatório, até 80 caracteres.

## Movimento

```json
{
  "product_id": "UUID_DO_PRODUTO",
  "type": "IN",
  "quantity": 20,
  "reason": "Estoque inicial",
  "request_id": "UUID_NOVO_PARA_ESTA_OPERACAO"
}
```

Tipos: `IN` e `OUT`. Quantidade inteira entre 1 e 1.000.000.000. Saldo final máximo de 1.000.000.000. Motivo obrigatório até 500 caracteres. Gere um UUID por operação e **reutilize-o ao reenviar o mesmo conteúdo após falha de rede**. Um novo lançamento deve ter novo UUID. Não há atualização ou remoção do histórico.

## Erros

Formato da aplicação: `{"message":"Descrição em português"}`. Códigos: 400 validação/credenciais, 401 sessão ausente ou expirada, 403 CSRF inválido, 404 registro ausente, 409 conflito (saldo, SKU, categoria vinculada), 429 excesso de tentativas, 502/503 integração indisponível. A resposta de CSRF 403 é gerenciada pelo Spring Security; a interface também trata respostas sem JSON.
