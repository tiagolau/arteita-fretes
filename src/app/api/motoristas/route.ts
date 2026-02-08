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

    const [motoristas, total] = await Promise.all([
      db.motorista.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { nome: 'asc' },
      }),
      db.motorista.count({ where }),
    ])

    return NextResponse.json({
      data: motoristas,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching motoristas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar motoristas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, cnh, telefone, whatsapp } = body

    if (!nome) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const motorista = await db.motorista.create({
      data: {
        nome,
        cnh,
        telefone,
        whatsapp,
      },
    })

    return NextResponse.json(motorista, { status: 201 })
  } catch (error) {
    console.error('Error creating motorista:', error)
    return NextResponse.json(
      { error: 'Erro ao criar motorista' },
      { status: 500 }
    )
  }
}
