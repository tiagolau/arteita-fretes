import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function formatDate(date: Date): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')
    const origemId = searchParams.get('origemId')
    const destinoId = searchParams.get('destinoId')
    const transportadoraId = searchParams.get('transportadoraId')
    const motoristaId = searchParams.get('motoristaId')
    const caminhaoId = searchParams.get('caminhaoId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {
      deletedAt: null,
    }

    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) {
        where.data.gte = new Date(dataInicio)
      }
      if (dataFim) {
        const endDate = new Date(dataFim)
        endDate.setHours(23, 59, 59, 999)
        where.data.lte = endDate
      }
    }

    if (origemId) where.origemId = origemId
    if (destinoId) where.destinoId = destinoId
    if (transportadoraId) where.transportadoraId = transportadoraId
    if (motoristaId) where.motoristaId = motoristaId
    if (caminhaoId) where.caminhaoId = caminhaoId

    if (status && ['PENDENTE', 'VALIDADO', 'REJEITADO'].includes(status)) {
      where.status = status
    }

    if (search) {
      where.ticketNota = {
        contains: search,
        mode: 'insensitive' as const,
      }
    }

    const fretes = await db.frete.findMany({
      where,
      orderBy: { data: 'desc' },
      include: {
        origem: true,
        destino: true,
        transportadora: true,
        caminhao: true,
        motorista: true,
      },
    })

    // Build CSV
    const header = [
      'Data',
      'Origem',
      'Destino',
      'Toneladas',
      'Preco/Ton',
      'Valor Total',
      'Transportadora',
      'Ticket/Nota',
      'Placa',
      'Motorista',
      'Status',
      'Observacao',
    ].join(',')

    const rows = fretes.map((frete) => {
      return [
        escapeCsvField(formatDate(frete.data)),
        escapeCsvField(frete.origem.nome),
        escapeCsvField(frete.destino.nome),
        escapeCsvField(formatCurrency(frete.toneladas)),
        escapeCsvField(`R$ ${formatCurrency(frete.precoTonelada)}`),
        escapeCsvField(`R$ ${formatCurrency(frete.valorTotal)}`),
        escapeCsvField(frete.transportadora.razaoSocial),
        escapeCsvField(frete.ticketNota),
        escapeCsvField(frete.caminhao.placa),
        escapeCsvField(frete.motorista.nome),
        escapeCsvField(frete.status),
        escapeCsvField(frete.observacao || ''),
      ].join(',')
    })

    const csv = '\uFEFF' + [header, ...rows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=fretes.csv',
      },
    })
  } catch (error) {
    console.error('Error exporting fretes:', error)
    return NextResponse.json(
      { error: 'Erro ao exportar fretes' },
      { status: 500 }
    )
  }
}
