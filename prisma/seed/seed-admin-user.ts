// Cria (ou garante) o usuário padrão de acesso ao sistema, pra destravar o
// primeiro login numa instalação nova sem precisar expor a senha em tela,
// em log ou em documentação — a UI não mostra mais essa credencial (ver
// app/login/page.tsx no frontend).
//
// Idempotente: pode rodar de novo a qualquer momento (upsert por email).
//
// Uso (depois de `npm run build`): npm run db:seed:admin
// Credenciais configuráveis via env (senão usa os valores padrão do
// ambiente de teste do projeto): SEED_ADMIN_NAME, SEED_ADMIN_EMAIL,
// SEED_ADMIN_PASSWORD.

import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

const SALT_ROUNDS = 10;

async function main() {
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrador';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@locobra.com.br';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'senha123';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword, isActive: true, deletedAt: null },
      create: { name, email, password: hashedPassword },
    });

    // Nunca logar a senha — só a confirmação de que o usuário está pronto.
    console.log(`✔ Usuário "${email}" pronto para login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Falha ao preparar o usuário padrão:', error);
  process.exit(1);
});
