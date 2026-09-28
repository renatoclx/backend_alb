# LocObra — Backend

API do **LocObra**, sistema de gestão para empresa de locação e venda de
equipamentos: clientes, categorias, produtos, locações e vendas (com
controle de estoque transacional) e um módulo de dashboard com métricas
agregadas no banco.

Consumida pelo frontend em [`../frontend`](../frontend).

## Stack

- [NestJS](https://nestjs.com) + TypeScript — arquitetura modular
  (Controller → Service → DTO), um módulo por entidade de domínio
- [Prisma ORM](https://www.prisma.io) + PostgreSQL (`@prisma/adapter-pg`)
- JWT (`@nestjs/jwt` + `passport-jwt`) — guard de autenticação global,
  rotas públicas marcadas com `@Public()`
- `class-validator` / `class-transformer` — validação e transformação de
  payload nos DTOs
- Docker Compose — banco de dados local

## Pré-requisitos

- Node.js 20+
- Docker (para o PostgreSQL local)

## Como rodar

### Caminho rápido

```bash
npm run setup      # instala, sobe o Postgres, migra, compila e roda os seeds
npm run start:dev
```

`npm run setup` (`scripts/setup.sh`) é idempotente — pode rodar de novo a
qualquer momento sem duplicar dados. Ele faz tudo isso:

1. Cria `.env` a partir de `.env.example`, se não existir.
2. `npm install`.
3. Sobe o Postgres via Docker Compose (`npm run db:up`) e espera ficar saudável.
4. Aplica as migrations (`prisma migrate deploy`).
5. Compila (`npm run build`).
6. Popula as cidades — `npm run db:seed:cities` (só roda se a tabela estiver vazia).
7. Garante o usuário padrão de acesso — `npm run db:seed:admin` (upsert, não
   loga a senha em nenhum momento).

API sobe em `http://localhost:3333` (ou a `PORT` configurada).

### Passo a passo manual (equivalente)

```bash
npm install
cp .env.example .env       # ajuste as variáveis se necessário (ver tabela abaixo)
npm run db:up               # sobe o Postgres via Docker Compose
npx prisma migrate deploy   # aplica as migrations
npm run build
npm run db:seed:cities      # popula cidades (obrigatório — sem tela de cadastro)
npm run db:seed:admin       # garante o usuário padrão
npm run start:dev
```

### Primeiro acesso

Não há tela de cadastro de usuário — a API não tem essa rota pública além
da que cria o primeiro acesso. `npm run db:seed:admin` (rodado pelo
`npm run setup`) garante o usuário padrão do ambiente de dev via
`prisma/seed/seed-admin-user.ts` (upsert idempotente, credenciais
configuráveis por `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` /
`SEED_ADMIN_NAME`, com um padrão pré-definido no script — combine com o
time antes de usar em qualquer ambiente compartilhado). A senha nunca é
impressa no console nem exposta na tela de login do frontend.

Alternativa, para criar outro usuário: `POST /users` (rota pública) com
`name`/`email`/`password`/`passwordConfirmation`. Depois, `POST /auth/login`
devolve o `accessToken` (Bearer) usado em todo o restante da API.

## Variáveis de ambiente (`.env`)

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PORT` | sim | Porta da API |
| `DATABASE_URL` | sim | Connection string do PostgreSQL |
| `JWT_SECRET` | sim | Segredo de assinatura do JWT |
| `JWT_EXPIRES_IN` | sim | Validade do token (ex.: `1h`) |
| `APP_TIMEZONE` | não | Fuso usado nas agregações do Dashboard (default `America/Sao_Paulo`) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | sim (Docker) | Credenciais do container do `docker-compose.yml` |

Validadas na subida da aplicação (`src/config/env.validation.ts`) — falha
rápido se faltar alguma.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run start:dev` | Desenvolvimento, com watch |
| `npm run build` | Build de produção (`nest build`) |
| `npm run start:prod` | Sobe o build (`dist/main`) |
| `npm run lint` | ESLint + Prettier (`--fix`) |
| `npm run test` / `test:e2e` / `test:cov` | Testes Jest |
| `npm run setup` | Setup completo do zero (idempotente) — ver "Caminho rápido" acima |
| `npm run db:up` / `db:down` | Sobe/derruba o Postgres local |
| `npm run db:seed:cities` | Popula cidades (só roda se a tabela estiver vazia) |
| `npm run db:seed:admin` | Garante o usuário padrão de acesso (upsert) |
| `npm run db:seed` | Roda os dois seeds acima em sequência |
| `npm run prisma:migrate:dev` | Nova migration a partir do schema |
| `npm run prisma:studio` | UI de inspeção do banco |

## Módulos (`src/modules/`)

`auth`, `user`, `city`, `category`, `product`, `client`, `sale`, `rental`,
`dashboard`. Regra geral: uma requisição autenticada com Bearer token
passa pelo `JwtAuthGuard` global; só `POST /auth/login` e `POST /users`
são públicas.

## Documentação

A pasta [`docs/`](docs/) é a fonte da verdade do projeto — a documentação
das regras de negócio precede o código, nunca o contrário. Destaques:

- `architecture.md` / `coding-standards.md` — convenções de código e camadas
- `domain.md` / `database.md` / `business-rules.md` — modelo de domínio e regras
- `auth.md` — autenticação e autorização
- `decisions.md` — decisões de design não óbvias
- `technical-debt.md` — simplificações conscientes, a revisitar
- `implementation-summary.md` / `dashboard-and-list-search.md` — registro
  técnico de cada rodada de implementação
- `seed-cities.md` — geração do seed de municípios
