// Popula a tabela de cidades a partir de seed-cities.sql (645 municípios de
// SP). Idempotente: só roda se a tabela estiver vazia — o SQL faz INSERTs
// puros, sem ON CONFLICT, então rodar duas vezes duplicaria os registros.
//
// Uso (depois de `npm run build`): npm run db:seed:cities

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const existing = await prisma.city.count();
    if (existing > 0) {
      console.log(`✔ ${existing} cidades já cadastradas — nada a fazer.`);
      return;
    }

    // process.cwd(): o script sempre roda a partir da raiz do projeto
    // backend (via npm script) — não __dirname, que aponta pro dist/
    // compilado, onde o .sql não existe (tsc não copia arquivos .sql).
    const sqlPath = join(process.cwd(), 'prisma/seed/seed-cities.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    const statements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    const total = await prisma.city.count();
    console.log(`✔ ${total} cidades cadastradas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha ao popular cidades:', error);
  process.exit(1);
});
