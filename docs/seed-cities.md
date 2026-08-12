# Seed de Municípios do Estado de São Paulo

## Objetivo

Gerar um script SQL compatível com **PostgreSQL** para inserir **todos os municípios do estado de São Paulo** na tabela `cities`.

A estrutura será exatamente a da mesma da tabela City, que está no schema

````

## Requisitos obrigatórios

* Gere um único arquivo SQL contendo **todos os 645 municípios do estado de São Paulo**.
* Utilize o comando `INSERT INTO`.
* Gere um **UUID diferente** para cada registro utilizando a função nativa do PostgreSQL:

```sql
gen_random_uuid()
````

Caso o banco não possua a extensão `pgcrypto` habilitada, inclua no início do script:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Formato esperado

Utilize exatamente este padrão:

```sql
INSERT INTO cities (id, name, "createdAt")
VALUES
(gen_random_uuid(), 'Adamantina', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Adolfo', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Aguaí', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Águas da Prata', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Águas de Lindóia', CURRENT_TIMESTAMP);
```

A coluna `updatedAt` é nullable e não é preenchida no seed — só é registrada quando o registro sofrer uma alteração de fato.

## Regras

- Inserir **todos os 645 municípios oficiais** do Estado de São Paulo.
- Utilizar a grafia oficial do IBGE.
- Preservar todos os caracteres especiais e acentuação (UTF-8).
- Escapar corretamente apóstrofos caso existam.
- Não remover acentos.
- Não utilizar abreviações.
- Não utilizar IDs fixos.
- Não utilizar comandos de atualização (`UPDATE`) ou exclusão (`DELETE`).
- Não gerar comentários no SQL.
- O resultado final deve ser **apenas um script SQL executável**.

## Ordem

Ordenar os municípios alfabeticamente pelo nome.
