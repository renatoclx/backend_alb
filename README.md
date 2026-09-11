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

```bash
npm install

cp .env.example .env
# ajuste as variáveis se necessário (ver tabela abaixo)

npm run db:up              # sobe o Postgres via Docker Compose
npx prisma migrate dev     # aplica as migrations
npx prisma generate        # gera o client (roda junto do migrate, mas pode ser manual)

# seed de cidades (obrigatório — não há tela de cadastro de cidade)
psql "$DATABASE_URL" -f prisma/seed/seed-cities.sql

npm run start:dev
```

API sobe em `http://localhost:3333` (ou a `PORT` configurada).

### Primeiro acesso

Não há seed de usuário. Crie o primeiro via rota pública:

```bash
curl -X POST http://localhost:3333/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@exemplo.com","password":"...","passwordConfirmation":"..."}'
```

Depois, `POST /auth/login` devolve o `accessToken` (Bearer) usado em todo
o restante da API.

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
| `npm run db:up` / `db:down` | Sobe/derruba o Postgres local |
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
