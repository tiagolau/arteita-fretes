import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

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

    const [data, total] = await Promise.all([
      db.frete.findMany({
        where,
        skip,
        take: limit,
        orderBy: { data: 'desc' },
        include: {
          origem: true,
          destino: true,
          transportadora: true,
          caminhao: true,
          motorista: true,
        },
      }),
      db.frete.count({ where }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching fretes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar fretes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      data,
      origemId,
      destinoId,
      toneladas,
      precoTonelada,
      transportadoraId,
      ticketNota,
      caminhaoId,
      motoristaId,
      observacao,
      origemRegistro,
    } = body

    // Validate required fields
    if (!data) {
      return NextResponse.json({ error: 'Data é obrigatória' }, { status: 400 })
    }
    if (!origemId) {
      return NextResponse.json({ error: 'Origem é obrigatória' }, { status: 400 })
    }
    if (!destinoId) {
      return NextResponse.json({ error: 'Destino é obrigatório' }, { status: 400 })
    }
    if (toneladas === undefined || toneladas === null || toneladas <= 0) {
      return NextResponse.json({ error: 'Toneladas deve ser maior que zero' }, { status: 400 })
    }
    if (precoTonelada === undefined || precoTonelada === null || precoTonelada <= 0) {
      return NextResponse.json({ error: 'Preço por tonelada deve ser maior que zero' }, { status: 400 })
    }
    if (!transportadoraId) {
      return NextResponse.json({ error: 'Transportadora é obrigatória' }, { status: 400 })
    }
    if (!ticketNota) {
      return NextResponse.json({ error: 'Ticket/Nota é obrigatório' }, { status: 400 })
    }
    if (!caminhaoId) {
      return NextResponse.json({ error: 'Caminhão é obrigatório' }, { status: 400 })
    }
    if (!motoristaId) {
      return NextResponse.json({ error: 'Motorista é obrigatório' }, { status: 400 })
    }

    // Calculate valorTotal
    const valorTotal = parseFloat(toneladas) * parseFloat(precoTonelada)

    // Determine status based on origemRegistro
    const registro = origemRegistro || 'MANUAL'
    const status = registro === 'WHATSAPP' ? 'PENDENTE' : 'VALIDADO'

    const frete = await db.frete.create({
      data: {
        data: new Date(data),
        origemId,
        destinoId,
        toneladas: parseFloat(toneladas),
        precoTonelada: parseFloat(precoTonelada),
        valorTotal,
        transportadoraId,
        ticketNota,
        caminhaoId,
        motoristaId,
        observacao: observacao || null,
        status,
        origemRegistro: registro,
      },
      include: {
        origem: true,
        destino: true,
        transportadora: true,
        caminhao: true,
        motorista: true,
      },
    })

    return NextResponse.json(frete, { status: 201 })
  } catch (error: any) {
    console.error('Error creating frete:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um frete com este Ticket/Nota' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Erro ao criar frete' },
      { status: 500 }
    )
  }
}
