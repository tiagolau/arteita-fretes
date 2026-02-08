#!/bin/sh
set -e

echo "🔄 Aplicando schema do banco de dados..."
npx prisma db push --skip-generate 2>&1 || echo "⚠️  Aviso: prisma db push falhou (banco pode não estar acessível ainda)"

echo "🚀 Iniciando aplicação..."
exec "$@"
