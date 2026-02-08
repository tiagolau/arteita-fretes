import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}

    if (search) {
      where.nome = {
        contains: search,
        mode: 'insensitive' as const,
      }
    }

    const grupos = await db.grupoWhatsapp.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { oportunidades: true },
        },
      },
    })

    return NextResponse.json({ data: grupos })
  } catch (error) {
    console.error('Error fetching grupos whatsapp:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar grupos' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, grupoId, palavrasChave } = body

    if (!nome || !grupoId) {
      return NextResponse.json(
        { error: 'Nome e grupoId sao obrigatorios' },
        { status: 400 }
      )
    }

    // Check if grupoId already exists
    const existing = await db.grupoWhatsapp.findUnique({
      where: { grupoId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Grupo com este grupoId ja existe' },
        { status: 409 }
      )
    }

    const grupo = await db.grupoWhatsapp.create({
      data: {
        nome,
        grupoId,
        palavrasChave: palavrasChave || [],
      },
    })

    return NextResponse.json(grupo, { status: 201 })
  } catch (error) {
    console.error('Error creating grupo whatsapp:', error)
    return NextResponse.json(
      { error: 'Erro ao criar grupo' },
      { status: 500 }
    )
  }
}
