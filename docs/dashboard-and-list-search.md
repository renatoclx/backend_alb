# Dashboard e busca/paginação nas listagens

Continuação de `implementation-summary.md`. Registra o que foi implementado
numa rodada posterior (2026‑09‑10), focada em duas frentes:

1. **Módulo `dashboard`** — agregações para a tela inicial do frontend.
2. **Busca e paginação server‑side** em todas as listagens (`?search`,
   `?status`, `?type`), substituindo o padrão em que o frontend baixava a
   lista inteira (`?limit=1000`) e filtrava no cliente.

**Nenhuma migration foi criada** — nada mudou no `schema.prisma`. Todas as
entidades já tinham os campos necessários.

---

## 1. Módulo `dashboard`

Novo módulo em `src/modules/dashboard/` (Controller + Service + Entities +
1 DTO). Não importa nada além do que já é global (`PrismaModule` é
`@Global`). Registrado em `app.module.ts`.

Princípio: **toda agregação é feita no banco** (`aggregate`, `count`,
`$queryRaw`) — nunca carregando linhas só para contar/somar no Node.

### Endpoints

| Rota | Retorno | Como é calculado |
| --- | --- | --- |
| `GET /dashboard/metrics` | `{ monthRevenue, activeRentals, monthSales, activeClients }` | 1 `$queryRaw` (somas do mês + `COUNT` de vendas do mês + `COUNT(DISTINCT clientId)` do `UNION` locações ACTIVE ∪ vendas do mês) + `rental.count({ status: ACTIVE })` |
| `GET /dashboard/revenue?days=7\|30\|90` | `[{ date, rentals, sales, total }]` | `$queryRaw` com `generate_series` (1 ponto por dia, zero‑fill) + `LEFT JOIN` das somas por `date_trunc('day', ...)` |
| `GET /dashboard/recent-movements` | `[{ id, type, client, total, date, status }]` — 10 itens | top 10 `sale` + top 10 `rental` por `createdAt` (Prisma, `select` mínimo + nome do cliente), mescladas e cortadas em 10 no Service |
| `GET /dashboard/upcoming-returns` | `[{ id, client, expectedReturnDate, status, daysOverdue }]` — 10 itens | `rental.findMany({ where: { returnedAt: null }, orderBy: { expectedReturnDate: 'asc' }, take: 10 })` — atrasadas caem primeiro naturalmente |

### Fuso horário (`APP_TIMEZONE`)

`Prisma.DateTime` é gravado como `timestamp` **sem** fuso (valor UTC). Para
que "mês atual" e "por dia" respeitem o fuso do negócio, o SQL do
`dashboard` converte antes de truncar:

```sql
date_trunc('day', ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $tz))
```

`$tz` vem de `APP_TIMEZONE` (default `America/Sao_Paulo`; o Brasil não tem
horário de verão desde 2019, então é offset fixo). A variável é opcional e
validada em `config/env.validation.ts` (`@IsOptional @IsString`).

> ⚠️ Um `APP_TIMEZONE` inválido faz o Postgres lançar erro e derruba os
> endpoints do `dashboard` — é config de operação, falha explícita.

### Cache leve das métricas

`DashboardService.getMetrics` guarda o resultado por **60 s** num campo
`{ value, expiresAt }` do próprio service. Sem dependência nova
(`@nestjs/cache-manager` seria overkill para um único método).

### `RevenueQueryDto`

`?days` só aceita `7 | 30 | 90` (`@IsIn`), default `30`. Com o
`ValidationPipe` global (`forbidNonWhitelisted: true`), `?days=15` → **400**.

### Entidades

`entities/dashboard.entity.ts` — `DashboardMetricsEntity`,
`RevenuePointEntity`, `RecentMovementEntity`, `UpcomingReturnEntity`.
`MovementStatus = RentalStatus | 'CONCLUDED'` — vendas não têm status, então
recebem o pseudo‑status `'CONCLUDED'` nas movimentações.

### Regra de negócio compartilhada — `computeRentalStatus`

A regra "locação `ACTIVE` com data prevista vencida é exibida como `DELAY`"
era um método privado de `RentalService`. Foi extraída para
`common/helpers/rental-status.helper.ts` (`computeRentalStatus`) e agora é
usada por `RentalService` **e** `DashboardService` — sem duplicar a regra.

`RentalService.withComputedStatus` virou genérico
(`<T extends { status; expectedReturnDate }>`) para preservar o tipo do
payload enriquecido (ver seção 2).

### Métricas × modelo de dados (no‑ops documentados)

`dashboard-metrics.md` (frontend) pede "não considerar registros cancelados
/ excluídos logicamente". Hoje isso é **no‑op**: `Sale` não tem status;
`Rental` só tem `ACTIVE/RETURNED/DELAY`; nenhum dos dois tem `deletedAt`
(exceção já registrada em `database.md` / `decisions.md` — Sale/Rental são
imutáveis, sem cancelamento — ver `technical-debt.md`). As métricas somam
todas as vendas e locações do período.

`activeRentals` conta `status = 'ACTIVE'` no banco (inclui as vencidas —
"contratos em andamento").

---

## 2. Busca e paginação nas listagens

### Helper `containsInsensitive`

`common/helpers/search.helper.ts`:

```ts
export function containsInsensitive(
  value: string | undefined | null,
): Prisma.StringFilter | undefined {
  const term = value?.trim();
  return term ? { contains: term, mode: 'insensitive' } : undefined;
}
```

Retorna `undefined` quando não há termo, para ser espalhado
condicionalmente dentro de qualquer `where`.

### `?search` nas listagens

Adicionado ao `findAll` de **client, product, category, city, rental
(nome do cliente), sale (nome do cliente)**. Sempre:

- opcional e **aditivo** — as chamadas antigas (`?limit=1000` sem
  `search`) continuam funcionando;
- o mesmo `where` no `findMany` e no `count` (paginação real);
- novo `*-query.dto.ts` por módulo estendendo `PaginationQueryDto`.

### Filtros específicos

- **`rental` — `?status=ativa|devolvida|atrasada`** (`@IsIn`). Traduzido
  para `where` no Service, porque `DELAY` **não é persistido**:
  - `ativa` → `{ status: ACTIVE, expectedReturnDate: { gte: now } }`
  - `atrasada` → `{ status: ACTIVE, expectedReturnDate: { lt: now } }`
  - `devolvida` → `{ status: RETURNED }`
- **`sale` — `?search` (cliente) + `?productSearch` (produto)**, filtros
  independentes (AND). `productSearch` usa
  `{ items: { some: { product: { name: <filter> } } } }`. Os dois filtros
  existem porque `screens.md` define "Nome do Cliente" e "Nome do Produto"
  como filtros separados na tela de Vendas.
- **`product` — `?type=SALE|RENTAL`** (`@IsEnum(ProductType)`). Usado pelos
  comboboxes de lançamento (venda/locação).
- **`category` — `productsCount`** via `include: { _count: { select: { products: true } } }`.
  Conta **todos** os produtos, inclusive os soft deleted — mesma base da
  regra que bloqueia a exclusão da categoria (interpretação conservadora,
  já registrada em `implementation-summary.md` §6).

### Includes de nome nas respostas

O frontend cruzava as listagens com `/clients` e `/products` só para
exibir nomes. Agora esses nomes vêm na própria resposta, via constantes
`*_INCLUDE` no topo de cada Service:

| Constante | Aplicada em | Traz |
| --- | --- | --- |
| `CLIENT_INCLUDE` | client: `create`, `findAll`, `findOrThrow`, `update`, `restore` | `city: { name }` |
| `PRODUCT_INCLUDE` | product: `findAll` | `category: { name }` |
| `RENTAL_INCLUDE` | rental: `create`, `findAll`, `findOrThrow`, `returnRental` | `client: { name, document, phone, city: { name } }` + `items[].product: { name }` |
| `SALE_INCLUDE` | sale: `create`, `findAll`, `findOne` | idem `RENTAL_INCLUDE` |

Os campos foram adicionados como **opcionais** nas entidades
(`client?`, `category?`, `items[].product?`) — presentes só onde o
`include` é aplicado.

`ClientEntity` ganhou `city?: { name }`; `ProductEntity`, `category?`;
`RentalEntity`/`SaleEntity`, `client?`; `RentalItemEntity`/`SaleItemEntity`,
`product?`.

### `city`

`GET /cities` ganhou `?search`. `GET /cities/:id` já existia. Isso permitiu
o frontend parar de baixar e cachear as 645 cidades para o combobox.

---

## 3. Arquivos

### Criados

```
src/common/helpers/search.helper.ts
src/common/helpers/rental-status.helper.ts
src/modules/dashboard/dashboard.module.ts
src/modules/dashboard/dashboard.controller.ts
src/modules/dashboard/dashboard.service.ts
src/modules/dashboard/entities/dashboard.entity.ts
src/modules/dashboard/dto/revenue-query.dto.ts
src/modules/category/dto/category-query.dto.ts
src/modules/city/dto/city-query.dto.ts
src/modules/rental/dto/rental-query.dto.ts
src/modules/sale/dto/sale-query.dto.ts
```

### Alterados

```
src/app.module.ts                          registra DashboardModule
src/config/env.validation.ts               APP_TIMEZONE (opcional)
.env / .env.example                        APP_TIMEZONE=America/Sao_Paulo
src/modules/client/dto/client-query.dto.ts        + search
src/modules/client/client.service.ts              + search + CLIENT_INCLUDE
src/modules/client/entities/client.entity.ts      + city?
src/modules/product/dto/product-query.dto.ts       + search + type
src/modules/product/product.service.ts            + search/type + PRODUCT_INCLUDE
src/modules/product/entities/product.entity.ts     + category?
src/modules/category/category.controller.ts        CategoryQueryDto
src/modules/category/category.service.ts           + search + _count
src/modules/category/entities/category.entity.ts   + productsCount?
src/modules/city/city.controller.ts                CityQueryDto
src/modules/city/city.service.ts                   + search
src/modules/rental/rental.controller.ts            RentalQueryDto
src/modules/rental/rental.service.ts               + search/status + RENTAL_INCLUDE, helper
src/modules/rental/entities/rental.entity.ts       + client?
src/modules/rental/entities/rental-item.entity.ts  + product?
src/modules/sale/sale.controller.ts                SaleQueryDto
src/modules/sale/sale.service.ts                   + search/productSearch + SALE_INCLUDE
src/modules/sale/entities/sale.entity.ts           + client?
src/modules/sale/entities/sale-item.entity.ts      + product?
```

---

## 4. Como foi validado

Sem suíte automatizada (o projeto não tem specs). Validação por:

- `tsc --noEmit`, `eslint --fix`, `nest build` sem erros.
- **Smoke tests HTTP** contra uma instância subida em porta alternativa
  (`PORT=3334 node dist/src/main`), cobrindo:
  - `/dashboard/metrics` (somas consistentes com `/dashboard/revenue`),
    `?days=7/30/90` (7/30/90 pontos), `?days=15` → 400, cache (2ª chamada
    ~sub‑ms);
  - `?search` case‑insensitive em cada módulo, `?search` sem resultado → 0;
  - `rental ?status=ativa/devolvida/atrasada` (traduções corretas),
    `?status=xxx` → 400;
  - `sale ?search` / `?productSearch`;
  - `product ?type=SALE`;
  - `category` com `productsCount`;
  - respostas de `rental`/`sale`/`client`/`product` trazendo os nomes.
- Frontend dirigido por Playwright contra o app real, confirmando busca +
  paginação + filtros server‑side nas 5 telas de listagem e nos
  comboboxes de lançamento.

---

## 5. Pendências

- `docs/` do **frontend** (`implementacao-integracao-api.md`) tem uma
  seção "Pendências" dizendo que a API não tem busca por nome e descrevendo
  o padrão "buscar tudo" — **obsoleto** depois desta rodada.
- `dashboard` não tem specs; um `dashboard.service.spec.ts` cobrindo as
  queries `$queryRaw` (fuso, zero‑fill, `days`) seria útil.
- Fuso: em produção, garantir `APP_TIMEZONE` setado se o servidor não
  estiver em `America/Sao_Paulo`.
