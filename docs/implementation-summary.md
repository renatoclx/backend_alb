# Resumo das Implementações

Este documento resume, em tópicos, tudo o que foi implementado nesta fase do projeto — cadastros básicos (City, User, Client, Category, Product) e o módulo de Venda/Locação (Sale/Rental). O objetivo é servir de material de estudo e referência rápida para entender o que existe no código e por quê.

---

## 1. Documentação (`docs/`)

- Revisão de `architecture.md`, `business-rules.md`, `domain.md`, `database.md` para identificar inconsistências antes de implementar.
- Correções aplicadas:
  - `domain.md`: typo em City ("por" → "pode"); adicionado atributo `isActive` ao User.
  - `database.md`: seção "Exceções ao soft delete" explicitando quais entidades **não** usam `deletedAt` e por quê (City, Category, Sale/SaleItem/Rental/RentalItem).
  - `business-rules.md`: typo "passwowrd" → "password"; regra de reativação de User; seções novas para Sale e Rental; nota de referência cruzada para `auth.md`.
- Arquivos novos criados:
  - `decisions.md`: registra decisões de design não óbvias (ex.: por que Category é hard delete, por que email/documento do Client não podem ser reaproveitados após soft delete, por que Sale/Rental usam preço "snapshot").
  - `technical-debt.md`: registra simplificações conscientes que devem ser revisitadas (tarifação de locação por período, ausência de cancelamento de venda/locação).
  - Este arquivo (`implementation-summary.md`).

**Por que isso importa**: no fluxo deste projeto, a documentação é a fonte da verdade para regras de negócio — o código deve implementar o que está documentado, nunca o contrário. Sempre que uma regra não estava clara ou não existia, paramos para perguntar antes de codificar (ex.: mecanismo de "confirmar cidade" no Client, modelagem de Sale/Rental).

---

## 2. Banco de dados (Prisma)

Duas migrations foram criadas nesta fase:

1. **`user_soft_delete_and_optional_birthdate`**
   - `Client.birthDate` passou de obrigatório para opcional (`DateTime?`), corrigindo uma divergência entre o schema e a regra de negócio já documentada.
   - `User` ganhou o campo `deletedAt`, para suportar dois estados distintos: inativo (`isActive=false`, reversível) e removido (`deletedAt` preenchido, requer estar inativo antes).

2. **`add_sale_and_rental`**
   - Novos models: `Sale`, `SaleItem`, `Rental`, `RentalItem`, e o enum `RentalStatus` (`ACTIVE` | `RETURNED`).
   - Relacionamentos: `Client` 1:N `Sale`/`Rental`; `Product` 1:N `SaleItem`/`RentalItem` (implementando o N:N Client↔Product através dessas tabelas de item).

**Convenção seguida**: toda entidade usa soft delete (`deletedAt`) por padrão, exceto quando documentado como exceção — isso está centralizado em `database.md`.

---

## 3. Estrutura da aplicação (NestJS)

```
src/
  common/       -> utilitários compartilhados entre módulos
  config/       -> validação de variáveis de ambiente
  prisma/       -> PrismaService (acesso único e centralizado ao banco)
  modules/
    auth/
    user/
    city/
    category/
    product/
    client/
    sale/
    rental/
```

### `common/`
- `dto/pagination-query.dto.ts`: `page`/`limit` padrão para listagens.
- `dto/transaction-item.dto.ts`: item (`productId` + `quantity`) reutilizado por Sale e Rental.
- `helpers/pagination.helper.ts`: monta a resposta paginada (`items`, `total`, `page`, `limit`).
- `helpers/duplicate-check.helper.ts`: valida que uma lista de itens não repete o mesmo produto (Sale/Rental).
- `decorators/public.decorator.ts`: marca uma rota como pública (`@Public()`), ignorando o guard de autenticação global.
- `decorators/match.decorator.ts`: validador customizado para campos que precisam ser iguais (ex.: `password`/`passwordConfirmation`).

### `config/`
- `env.validation.ts`: valida `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` na subida da aplicação (falha rápido se faltar alguma variável).

### Padrão de cada módulo
Controller → Service → DTOs → Module, conforme `architecture.md`. Regra de negócio sempre no Service; Controller só recebe/repassa dados já validados pelo DTO.

---

## 4. Autenticação (`auth` + `user`)

- **Estratégia**: JWT (`@nestjs/jwt` + `passport-jwt`), payload contém apenas `sub` (id) e `email`.
- **Guard global**: `JwtAuthGuard` é aplicado em **todas** as rotas por padrão (via `APP_GUARD`). Rotas públicas usam `@Public()` para escapar do guard — hoje são só `POST /users` (cadastro) e `POST /auth/login`.
- **User**:
  - Cadastro exige confirmação de senha (`password` + `passwordConfirmation` iguais).
  - Senha nunca é retornada nas respostas (a entidade de resposta é montada manualmente sem o campo `password`).
  - Dois estados de "desligamento": **inativo** (`isActive=false`, reversível via `PATCH /users/:id/reactivate`) e **removido** (`deletedAt`, só permitido se já estiver inativo, não aparece mais nas listagens).
  - Troca de senha exige a senha atual + confirmação da nova.

---

## 5. City

- Somente leitura (`GET /cities`, `GET /cities/:id`). Sem create/update/delete — mantida via seed, conforme regra de negócio.
- Serve principalmente para validar o `cityId` do Client.

---

## 6. Category

- CRUD completo. Nome único.
- **Exclusão física** (hard delete), não soft delete — só permitida se não houver produtos vinculados. Essa é uma exceção deliberada à regra padrão de soft delete (documentada em `decisions.md`).
- Nota: mesmo produtos **soft deleted** contam como "vinculados" para efeito de bloquear a exclusão da categoria (interpretação conservadora, confirmada com você).

---

## 7. Product

- CRUD completo. `reference` é opcional, mas único **dentro da mesma categoria** (`@@unique([categoryId, reference])`).
- Pode trocar de categoria; ao mudar categoria e/ou reference, a unicidade é revalidada para a combinação nova.
- Soft delete — mas com uma regra adicional implementada depois (seção 9): não pode ser removido se tiver histórico de venda ou locação.

---

## 8. Client

- CRUD completo + **restore** (um cliente removido via soft delete pode ser restaurado).
- `email` e `document` são únicos **mesmo contra registros soft deleted** — ou seja, uma vez usados, não podem ser reaproveitados por outro cadastro (decisão registrada em `decisions.md`, incomum em relação ao padrão usual de soft delete).
- Alterar `address` exige reenviar `cityId` junto (mesmo que seja a mesma cidade) — é o mecanismo de "confirmação de cidade" que você definiu. A cidade nunca muda sozinha, sempre junto com o endereço.
- Listagem exclui removidos por padrão; parâmetro `includeDeleted=true` traz todos.
- Não pode ser removido se tiver histórico de venda ou locação (seção 9).

---

## 9. Sale (Venda) e Rental (Locação) — o módulo mais complexo

### Modelagem
- **Sale** e **Rental** são entidades separadas (não uma "Transaction" genérica), porque têm ciclos de vida diferentes: Rental tem devolução, Sale não.
- Cada uma tem **itens** (`SaleItem`/`RentalItem`) — uma venda/locação pode conter vários produtos, cada um com sua quantidade.
- **Preço snapshot**: `unitPrice` do item é copiado do `Product.salePrice`/`rentalPrice` no momento da criação. Se o preço do produto mudar depois, vendas/locações antigas não são afetadas — fica um retrato fiel do que foi cobrado.

### Estoque
- Criar uma venda/locação **decrementa** `Product.quantity` automaticamente.
- O decremento é feito com `updateMany({ where: { quantity: { gte: solicitado } } })` dentro de uma transação (`$transaction`) — isso garante que, mesmo com duas requisições concorrentes, nunca vai vender/locar mais do que existe em estoque (a condição `gte` é checada atomicamente pelo próprio banco, não em duas etapas separadas de "ler depois escrever").
- Devolver uma locação (`PATCH /rentals/:id/return`) **repõe** o estoque (`increment`). Venda não tem devolução, então nunca repõe.
- `minimalQuantity` continua sendo só informativo — não bloqueia nada.

### Regras de validação
- Sempre precisa de ao menos 1 item.
- Não pode repetir o mesmo produto na lista de itens da mesma venda/locação.
- `Rental.expectedReturnDate` precisa ser uma data futura.
- Cliente e produtos são validados via os Services de `Client`/`Product` (nunca acessando a tabela de outro módulo diretamente pelo Prisma — respeita a regra de `architecture.md`).

### Dependência circular (ponto técnico interessante)
- `Sale`/`Rental` precisam validar `Client`/`Product` (para criar a venda/locação).
- `Client`/`Product` precisam perguntar a `Sale`/`Rental` se existe histórico (para decidir se podem ser excluídos).
- Isso é uma dependência circular real entre módulos. Resolvida com `forwardRef()` do NestJS nos dois lados (no `@Module({ imports: [...] })` e no `@Inject()` dos construtores) — é o padrão oficialmente suportado pelo Nest para esse caso, sem precisar quebrar a regra de "Service só acessa o próprio Prisma".

### Regra retroativa habilitada
- Com Sale/Rental existindo, passou a valer de fato a regra (já documentada antes, mas não implementável) de que **Client e Product não podem ser excluídos se tiverem histórico de venda ou locação**.

---

## 10. O que ficou de fora (de propósito) — ver `technical-debt.md`

- **Tarifação de locação por período** (1 dia, 1 semana, 1 mês, cada um com valor próprio): hoje o preço é fechado por unidade, independente do prazo. Adiado porque exigiria redesenhar o modelo de preços do `Product`.
- **Cancelamento de venda/locação**: não existe endpoint de update/delete para Sale/Rental nesta fase — são registros imutáveis uma vez criados.
- **Reativação de usuário** foi implementada, mas não existe "reativação"/"restore" simétrico documentado para outras entidades além de Client (restore) e User (reactivate).

---

## 11. Como foi validado

Cada módulo foi validado com:
- `tsc --noEmit` (checagem de tipos) e `npm run lint` (ESLint + Prettier) sem erros.
- `npm run build` completo.
- **Smoke tests reais**: subida do servidor + chamadas HTTP via `curl` cobrindo os caminhos felizes e as regras de negócio (ex.: bloqueio de e-mail duplicado, estoque insuficiente, devolução dupla, exclusão bloqueada por histórico). Todos os dados de teste foram removidos do banco ao final de cada rodada.

---

## 12. Glossário rápido de padrões usados no código

| Padrão | Onde | Por quê |
|---|---|---|
| DTO + `class-validator` | Todos os módulos | Validação de entrada acontece antes do Controller repassar ao Service |
| Soft delete (`deletedAt`) | User, Client, Product | Preserva histórico; "exclusão" é lógica, não física |
| Hard delete | Category | Sem produtos vinculados, não há histórico a preservar |
| `@Public()` + Guard global | Auth | Só 2 rotas são públicas; todo o resto exige JWT por padrão |
| `forwardRef()` | Client/Product ↔ Sale/Rental | Dependência circular legítima entre módulos |
| `$transaction` | Sale/Rental | Cria registro + decrementa/repõe estoque de forma atômica |
| Preço snapshot | SaleItem/RentalItem | Preço cobrado não muda retroativamente |
