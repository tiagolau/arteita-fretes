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
        OR: [
          {
            placa: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            modelo: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    }

    const [caminhoes, total] = await Promise.all([
      db.caminhao.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { placa: 'asc' },
      }),
      db.caminhao.count({ where }),
    ])

    return NextResponse.json({
      data: caminhoes,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error('Error fetching caminhoes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar caminhões' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { placa, modelo, capacidade } = body

    if (!placa) {
      return NextResponse.json(
        { error: 'Placa é obrigatória' },
        { status: 400 }
      )
    }

    const caminhao = await db.caminhao.create({
      data: {
        placa,
        modelo,
        capacidade,
      },
    })

    return NextResponse.json(caminhao, { status: 201 })
  } catch (error) {
    console.error('Error creating caminhao:', error)
    return NextResponse.json(
      { error: 'Erro ao criar caminhão' },
      { status: 500 }
    )
  }
}
