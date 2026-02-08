import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Filters
    const prioridade = searchParams.get('prioridade')
    const status = searchParams.get('status')
    const grupoId = searchParams.get('grupoId')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const where: Record<string, unknown> = {}

    if (prioridade) {
      where.prioridade = prioridade
    }

    if (status) {
      where.status = status
    }

    if (grupoId) {
      where.grupoId = grupoId
    }

    if (dataInicio || dataFim) {
      where.createdAt = {
        ...(dataInicio && { gte: new Date(dataInicio) }),
        ...(dataFim && { lte: new Date(dataFim) }),
      }
    }

    const [data, total] = await Promise.all([
      db.oportunidade.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          grupo: true,
        },
      }),
      db.oportunidade.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data,
      total,
      page,
      totalPages,
    })
  } catch (error) {
    console.error('Error fetching oportunidades:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar oportunidades' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      grupoId,
      mensagemOriginal,
      tipoCarga,
      origem,
      destino,
      tonelagem,
      precoOferecido,
      urgencia,
      contato,
      prioridade,
      status,
      expiresAt,
    } = body

    if (!grupoId || !mensagemOriginal) {
      return NextResponse.json(
        { error: 'grupoId e mensagemOriginal sao obrigatorios' },
        { status: 400 }
      )
    }

    // Default expiry: 48 hours from now
    const expiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 48 * 60 * 60 * 1000)

    const oportunidade = await db.oportunidade.create({
      data: {
        grupoId,
        mensagemOriginal,
        tipoCarga: tipoCarga || null,
        origem: origem || null,
        destino: destino || null,
        tonelagem: tonelagem ? parseFloat(tonelagem) : null,
        precoOferecido: precoOferecido ? parseFloat(precoOferecido) : null,
        urgencia: urgencia || null,
        contato: contato || null,
        prioridade: prioridade || 'MEDIA',
        status: status || 'NOVA',
        expiresAt: expiry,
      },
      include: {
        grupo: true,
      },
    })

    return NextResponse.json(oportunidade, { status: 201 })
  } catch (error) {
    console.error('Error creating oportunidade:', error)
    return NextResponse.json(
      { error: 'Erro ao criar oportunidade' },
      { status: 500 }
    )
  }
}
