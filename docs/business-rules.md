# Regras de Negócio

## City

- City é mantidade exclusivamente por meio de seed.
- Não é permitido cadastrar, editar ou excluir cities pela aplicação.
- A aplicação poderá consultar e listar cities cadastradas.

### Consulta

- Todas as cidades estarão liberadas para consulta.

---

## User

### Cadastro

- O email do user deve ser único.
- User somente poderá ser cadastrado quando a confirmação de password corresponder ao password informado.

### Alteração

- O e-mail poderá ser alterado, desde que continue único.
- A senha poderá ser alterada somente com a confirmação da senha atual.
- A nova senha também deverá ser validada com campo de confirmação.
- Um usuário poderá ser inativado sem necessidade de exclusão.
- Um usuário inativado poderá ser reativado, desde que não tenha sido removido (soft deleted).

### Exclusão

- Apenas usuários inativos poderão ser removidos da aplicação.
- Usuários não poderão ser excluídos fisicamente.
- A remoção é feita via soft delete (campo `deletedAt`), estado distinto da inativação (campo `isActive`).

### Consulta

- Listar usuários ativos e inativos na aplicação.
- Usuários removidos (soft deleted) não aparecem na listagem padrão, seguindo o mesmo padrão aplicado a Client.

### Autenticação

> Estratégia, tokens, guards e demais detalhes técnicos de autenticação estão documentados em `auth.md`. As regras abaixo descrevem apenas o comportamento esperado do ponto de vista de negócio.

- A autenticação será realizada utilizando e-mail e password.
- Users inativos não podem realizar login.
- Não pode existir mais de um user com o mesmo e-mail.
- Users autenticados recebem um JWT após login.
- O e-mail é utilizado como identificador para autenticação.

### Segurança

- O password deve ser armazenado utilizando hash (bcrypt).
- Nunca retornar o password nas respostas da API.

---

## Client

### Cadastro

- O e-mail do cliente é opcional. Quando informado, deve ser único.
- A data de nascimento do cliente é opcional.
- Não é permitido cadastrar dois clientes com o mesmo documento.
- Todo cliente deve possuir um endereço.
- Todo cliente deve estar associado a uma cidade cadastrada.

### Alteração

- O nome do cliente pode ser alterado.
- O e-mail do cliente poderá ser alterado, desde que continue único.
- O documento do cliente poderá ser alterado, desde que continue único.
- O telefone do cliente poderá ser alterado.
- Ao alterar o endereço do cliente, será necessário confirmar se o mesmo ainda reside na mesma cidade.
- A cidade não poderá ser alterada sem a alteração do endereço.
- A cidade poderá ser alterada apenas para uma cidade cadastrada.
  Um cliente removido via soft delete poderá ser restaurado.

### Exclusão

- Clientes com histórico de compras ou locações não poderão ser excluídos.
- Ao remover um cliente (softDelete), os atributos únicos já cadastrados não poderão ser reutilizados.

### Consulta

- Trazer por padrão os clientes que não estão soft deleteds.
- Clientes soft deleteds poderão ser listados caso desejado.

---

## Category

### Cadastro

- Toda categoria cadastrada deve possuir um nome.
- Não é permitido nomes duplicados.

### Alteração

- O nome da categoria poderá ser alterado, desde que continue único.

### Exclusão

- Uma categoria só poderá ser excluída caso não tenha produtos vinculados.
- A exclusão é física (hard delete), pois não há histórico a ser preservado nesse cenário. Ver `decisions.md`.

---

## Product

### Cadastro

- Todo produto deve ter um nome.
- Quando o campo reference for informado, não deverão ter referências duplicadas dentro de uma mesma categoria.
- O código de referência não representa a identidade do produto.
- Todo produto deve estar associado a uma categoria cadastrada.
- Todo produto deve ter um `type`: `SALE` (venda) ou `RENTAL` (locação).
- O preço do tipo não selecionado é sempre gravado como `null`, mesmo que
  seja enviado no payload — quando `type` é `SALE`, `rentalPrice` fica
  `null`; quando `type` é `RENTAL`, `salePrice` fica `null`. Quem decide
  qual preço é o do produto é o `type`, não o que o cliente mandou.

### Alteração

- Um produto poderá mudar de categoria.
- Um produto poderá mudar de `type` — nesse caso, o preço do tipo anterior
  é zerado (`null`) e passa a valer a mesma regra de nulling do cadastro.
- A alteração da referência deve respeitar a regra de unicidade dentro da categoria.
- Um produto removido via soft delete poderá ser restaurado.

### Exclusão

- Não é permitido excluir um produto que possua histórico de vendas ou locações.

### Consulta

- Todos os produtos poderão ser consultados.
- Produtos removidos (soft deleted) aparecem por padrão na listagem,
  seguindo o mesmo padrão aplicado a Client (`includeDeleted`).
- Uma venda não pode usar um produto com `salePrice` nulo (produto do
  tipo `RENTAL`); uma locação não pode usar um produto com `rentalPrice`
  nulo (produto do tipo `SALE`) — a API rejeita com erro claro.

---

## Sale

### Cadastro

- Toda venda deve estar associada a um cliente cadastrado.
- Toda venda deve possuir ao menos um item (produto + quantidade).
- Não é permitido repetir o mesmo produto mais de uma vez na lista de itens de uma mesma venda.
- O preço unitário de cada item é o `salePrice` do produto no momento da venda (não é alterado retroativamente caso o preço do produto mude depois).
- O total da venda é a soma de `quantity × unitPrice` de todos os itens.
- A quantidade vendida é debitada automaticamente do estoque (`Product.quantity`) no momento do cadastro.
- Não é permitido vender uma quantidade maior do que a disponível em estoque.

### Exclusão

- Não há exclusão ou cancelamento de venda nesta etapa. O registro é imutável após criado.

### Consulta

- Todas as vendas poderão ser consultadas.

---

## Rental

### Cadastro

- Toda locação deve estar associada a um cliente cadastrado.
- Toda locação deve possuir ao menos um item (produto + quantidade).
- Não é permitido repetir o mesmo produto mais de uma vez na lista de itens de uma mesma locação.
- Toda locação deve informar uma data prevista de devolução (`expectedReturnDate`), que deve ser uma data futura.
- O preço unitário de cada item é o `rentalPrice` do produto no momento da locação (valor fechado por unidade locada, não é multiplicado por dias/semanas/meses nesta etapa — ver `technical-debt.md`).
- O total da locação é a soma de `quantity × unitPrice` de todos os itens.
- A quantidade locada é debitada automaticamente do estoque (`Product.quantity`) no momento do cadastro.
- Não é permitido locar uma quantidade maior do que a disponível em estoque.

### Devolução

- Uma locação só pode ser devolvida uma vez; uma locação já devolvida não pode ser devolvida novamente.
- Ao devolver, a quantidade de cada item retorna ao estoque do respectivo produto (`Product.quantity`).
- A devolução registra a data efetiva (`returnedAt`) e altera o status da locação para devolvida.
- Uma locação em atraso (`DELAY`) também pode ser devolvida normalmente.

### Status

- Uma locação possui três status possíveis: `ACTIVE` (ativa), `DELAY` (atrasada) e `RETURNED` (devolvida).
- O status `DELAY` não é persistido no banco: é calculado dinamicamente nas consultas (listagem e busca por id). Uma locação com status `ACTIVE` cuja `expectedReturnDate` já passou é exibida como `DELAY`, sem alterar o registro em si.
- Uma locação recém-criada nunca nasce em `DELAY`, pois `expectedReturnDate` é obrigatoriamente uma data futura no cadastro.

### Exclusão

- Não há exclusão ou cancelamento de locação nesta etapa. O registro é imutável após criado.

### Consulta

- Todas as locações poderão ser consultadas.
