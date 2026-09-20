# StockFlow — apresentação para Workana

## Descrição sugerida

StockFlow é um projeto autoral de gestão de estoque voltado a pequenos negócios. Reúne cadastro de produtos e categorias, entradas e saídas, alertas de estoque mínimo e um dashboard com indicadores, em uma interface responsiva em português.

Desenvolvi o backend em Java com Spring Boot, integrado ao Supabase para autenticação e PostgreSQL. O sistema separa os dados de cada conta, impede saídas acima do saldo disponível e mantém o histórico das movimentações mesmo após a exclusão de um produto.

O projeto demonstra organização de código, integração com serviços externos, regras de negócio no banco, tratamento de erros e testes automatizados. Foi criado para demonstrar minha capacidade de transformar necessidades de controle de estoque em uma aplicação funcional.

**Tecnologias:** Java 21, Spring Boot, Spring Security, Supabase Auth, PostgreSQL, SQL, HTML, CSS, JavaScript, Docker, JUnit e ferramentas de teste de banco/navegador.

## Roteiro de demonstração de 2 minutos

1. Apresente o problema: produtos dispersos em planilhas e dificuldade para saber o que repor.
2. Entre na conta e mostre os indicadores e alertas.
3. Cadastre uma categoria e um produto com estoque mínimo.
4. Registre uma entrada e mostre o saldo atualizado.
5. Faça uma saída que deixe o item abaixo do mínimo; mostre o alerta.
6. Tente uma saída maior que o saldo para demonstrar a regra de negócio.
7. Busque o SKU no histórico e mostre o motivo e saldo de cada lançamento.
8. Mostre a interface em celular e encerre a sessão.

As capturas deste repositório usam dados fictícios. Se publicar a demonstração, use exclusivamente informações de exemplo. Não apresente o projeto como trabalho contratado nem afirme ganhos financeiros de clientes sem comprovação.
