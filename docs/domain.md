# Domínio

## City

- Representa uma cidade cadastrada na aplicação.

### Atributos

| Nome | Descrição           |
| ---- | ------------------- |
| id   | Identificador único |
| name | Nome da cidade      |

### Relacionamentos

- Uma cidade pode ter mais de um cliente associado.

---

## User

- Representa um usuário que possui acesso a aplicação.
- User não precisa necessariamente ser uma pessoa, ele será criado apenas para o acesso a aplicação.

### Responsabilidades

- Autenticar-se no sistema com e-mail e senha.
- Manter seus dados cadastrais corretamente.

### Atributos

| Nome     | Descrição                   |
| -------- | --------------------------- |
| id       | Identificador único          |
| name     | Nome do usuário              |
| email    | E-mail utilizado para login  |
| password | Hash da senha                |
| isActive | Indica se o usuário está ativo |

### Relacionamentos

- Nenhum até o momento.

---

## Client

- Representa um cliente cadastrado na aplicação.
- Cliente não é um usuário, é uma entidade isolada.
- Cliente está em uma cidade.

### Atributos

| Nome      | Descrição                  |
| --------- | -------------------------- |
| id        | Identificador único        |
| name      | Nome do cliente            |
| email     | E-mail do cliente          |
| phone     | Contato do cliente         |
| birthDate | Data de nascimento         |
| document  | Documento de identificação |
| address   | Endereço do cliente        |
| cityId    | Id da cidade associada     |

### Responsabilidades

- O cliente não terá acesso a aplicação.

### Relacionamentos

- Cliente possui uma cidade associada.
- Um cliente pode comprar/alugar mais de um produto.

---

## Category

- Representa uma categoria a qual um produto é associado.

## Atributos

| Nome | Descrição           |
| ---- | ------------------- |
| id   | Identificador único |
| name | Nome da categoria   |

## Responsabilidades

- Separar/classificar os produtos cadastrados.

### Relacionamentos

- Uma categoria pode ter mais de um produto vinculado.

---

## Product

- Representa um produto ou um equipamento cadastrado na aplicação.
- O produto estará sempre vinculado a uma categoria.
- O produto não será associado a uma cidade.

### Atributos

| Nome            | Descrição                       |
| --------------- | ------------------------------- |
| id              | Identificador único             |
| name            | Nome do produto                 |
| reference       | Código de referência do produto |
| description     | Descrição do produto            |
| purchasePrice   | Preço de compra                 |
| salePrice       | Preço de venda                  |
| rentalPrice     | Preço de locação                |
| quantity        | Quantidade em estoque           |
| minimalQuantity | Quantidade mínima de estoque    |
| categoryId      | Categoria associada             |

### Responsabilidades

- Nenhuma até o momento.

### Relacionamentos

- Um produto está associado a uma categoria.
- Um produto pode ser comprado/locado por mais de um cliente.

---

## Sale

- Representa uma venda de um ou mais produtos para um cliente.

### Atributos

| Nome     | Descrição                                    |
| -------- | --------------------------------------------- |
| id       | Identificador único                           |
| clientId | Cliente que realizou a compra                 |
| total    | Valor total da venda (soma dos itens)         |

### Responsabilidades

- Registrar o histórico de compras de um cliente.

### Relacionamentos

- Uma venda pertence a um único cliente.
- Uma venda possui um ou mais itens (SaleItem).

---

## SaleItem

- Representa um produto e a quantidade vendida dentro de uma Sale.

### Atributos

| Nome      | Descrição                                          |
| --------- | --------------------------------------------------- |
| id        | Identificador único                                  |
| saleId    | Venda associada                                      |
| productId | Produto vendido                                      |
| quantity  | Quantidade vendida                                   |
| unitPrice | Preço unitário praticado no momento da venda         |

### Relacionamentos

- Um item pertence a uma única venda.
- Um item referencia um único produto.

---

## Rental

- Representa uma locação de um ou mais produtos para um cliente.

### Atributos

| Nome               | Descrição                                          |
| ------------------ | ---------------------------------------------------- |
| id                 | Identificador único                                  |
| clientId           | Cliente que realizou a locação                       |
| total              | Valor total da locação (soma dos itens)              |
| startDate          | Data de início da locação                            |
| expectedReturnDate | Data prevista para devolução                         |
| returnedAt         | Data em que a devolução efetivamente ocorreu          |
| status             | Situação da locação (ativa ou devolvida)             |

### Responsabilidades

- Registrar o histórico de locações de um cliente.
- Controlar a devolução dos produtos locados.

### Relacionamentos

- Uma locação pertence a um único cliente.
- Uma locação possui um ou mais itens (RentalItem).

---

## RentalItem

- Representa um produto e a quantidade locada dentro de uma Rental.

### Atributos

| Nome      | Descrição                                          |
| --------- | --------------------------------------------------- |
| id        | Identificador único                                  |
| rentalId  | Locação associada                                    |
| productId | Produto locado                                       |
| quantity  | Quantidade locada                                    |
| unitPrice | Preço unitário praticado no momento da locação       |

### Relacionamentos

- Um item pertence a uma única locação.
- Um item referencia um único produto.
