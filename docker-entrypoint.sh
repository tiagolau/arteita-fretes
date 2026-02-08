#!/bin/sh
set -e

echo "🔄 Aplicando schema do banco de dados..."
npx prisma db push --accept-data-loss 2>&1 || echo "⚠️  Aviso: prisma db push falhou (banco pode não estar acessível ainda)"

echo "🌱 Executando seed do banco de dados..."
npx prisma db seed 2>&1 || echo "⚠️  Aviso: seed já foi executado ou falhou"

echo "🚀 Iniciando aplicação..."
exec "$@"
