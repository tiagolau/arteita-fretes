#!/bin/sh
set -e

# Usar prisma local do node_modules (evita npx baixar versão incompatível)
PRISMA="./node_modules/.bin/prisma"

echo "🔄 Aplicando schema do banco de dados..."
$PRISMA db push --accept-data-loss 2>&1 || echo "⚠️  Aviso: prisma db push falhou"

echo "🌱 Executando seed do banco de dados..."
$PRISMA db seed 2>&1 || echo "⚠️  Aviso: seed já foi executado ou falhou"

echo "🚀 Iniciando aplicação..."
exec "$@"
