import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '10')
    const skip = (page - 1) * perPage

    const where = {
      active: true,
      ...(search && {
        nome: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }),
    }

    const [origensDestinos, total] = await Promise.all([
      db.origemDestino.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { nome: 'asc' },
      }),
      db.origemDestino.count({ where }),
    ])

    return NextResponse.json({
      data: origensDestinos,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching origens/destinos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar origens/destinos' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, cidade, uf } = body

    if (!nome) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const origemDestino = await db.origemDestino.create({
      data: {
        nome,
        cidade,
        uf,
      },
    })

    return NextResponse.json(origemDestino, { status: 201 })
  } catch (error) {
    console.error('Error creating origem/destino:', error)
    return NextResponse.json(
      { error: 'Erro ao criar origem/destino' },
      { status: 500 }
    )
  }
}
