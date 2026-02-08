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
        razaoSocial: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }),
    }

    const [transportadoras, total] = await Promise.all([
      db.transportadora.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { razaoSocial: 'asc' },
      }),
      db.transportadora.count({ where }),
    ])

    return NextResponse.json({
      data: transportadoras,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching transportadoras:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar transportadoras' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { razaoSocial, cnpj, contato, telefone } = body

    if (!razaoSocial) {
      return NextResponse.json(
        { error: 'Razão Social é obrigatória' },
        { status: 400 }
      )
    }

    const transportadora = await db.transportadora.create({
      data: {
        razaoSocial,
        cnpj,
        contato,
        telefone,
      },
    })

    return NextResponse.json(transportadora, { status: 201 })
  } catch (error) {
    console.error('Error creating transportadora:', error)
    return NextResponse.json(
      { error: 'Erro ao criar transportadora' },
      { status: 500 }
    )
  }
}
