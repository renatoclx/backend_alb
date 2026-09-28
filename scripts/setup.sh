#!/usr/bin/env bash
# Prepara o ambiente local do zero: dependências, banco (Docker), migrations,
# build e os dois seeds (cidades + usuário padrão). Idempotente — pode rodar
# de novo sem duplicar nada.
#
# Uso: npm run setup   (ou ./scripts/setup.sh)

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o Docker antes de continuar." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> Criando .env a partir de .env.example"
  cp .env.example .env
fi

echo "==> Instalando dependências"
npm install

echo "==> Subindo o Postgres (Docker)"
npm run db:up

echo "==> Aguardando o banco ficar saudável"
status="starting"
for _ in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' alb_locacoes_postgres 2>/dev/null || echo "starting")
  [ "$status" = "healthy" ] && break
  sleep 1
done
if [ "$status" != "healthy" ]; then
  echo "O banco não ficou saudável a tempo. Confira: docker compose logs postgres" >&2
  exit 1
fi

echo "==> Aplicando migrations"
npx prisma migrate deploy

echo "==> Compilando"
npm run build

echo "==> Populando cidades (só roda se a tabela estiver vazia)"
npm run db:seed:cities

echo "==> Garantindo o usuário padrão de acesso"
npm run db:seed:admin

echo ""
echo "Pronto. Para subir a API: npm run start:dev"
echo "(porta padrão 3333, configurável em PORT no .env)"
