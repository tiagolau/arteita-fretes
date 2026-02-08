import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@arteita.com.br' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@arteita.com.br',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Criar operador
  await prisma.user.upsert({
    where: { email: 'operador@arteita.com.br' },
    update: {},
    create: {
      name: 'Operador',
      email: 'operador@arteita.com.br',
      password: await bcrypt.hash('operador123', 10),
      role: 'OPERADOR',
    },
  });

  // Origens/Destinos de exemplo
  const locais = [
    { nome: 'Itabira', cidade: 'Itabira', uf: 'MG' },
    { nome: 'Belo Horizonte', cidade: 'Belo Horizonte', uf: 'MG' },
    { nome: 'Ipatinga', cidade: 'Ipatinga', uf: 'MG' },
    { nome: 'Governador Valadares', cidade: 'Governador Valadares', uf: 'MG' },
    { nome: 'João Monlevade', cidade: 'João Monlevade', uf: 'MG' },
  ];

  for (const local of locais) {
    await prisma.origemDestino.upsert({
      where: { id: local.nome.toLowerCase().replace(/\s/g, '-') },
      update: {},
      create: {
        id: local.nome.toLowerCase().replace(/\s/g, '-'),
        ...local,
      },
    });
  }

  console.log('Seed completed!');
  console.log('');
  console.log('Usuários criados:');
  console.log('  Admin:    admin@arteita.com.br    / admin123');
  console.log('  Operador: operador@arteita.com.br / operador123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
