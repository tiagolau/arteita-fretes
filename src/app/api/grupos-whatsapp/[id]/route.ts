import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const grupo = await db.grupoWhatsapp.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { oportunidades: true },
        },
      },
    })

    if (!grupo) {
      return NextResponse.json(
        { error: 'Grupo nao encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(grupo)
  } catch (error) {
    console.error('Error fetching grupo whatsapp:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar grupo' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { nome, grupoId, active, palavrasChave } = body

    const grupo = await db.grupoWhatsapp.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(grupoId !== undefined && { grupoId }),
        ...(active !== undefined && { active }),
        ...(palavrasChave !== undefined && { palavrasChave }),
      },
    })

    return NextResponse.json(grupo)
  } catch (error) {
    console.error('Error updating grupo whatsapp:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar grupo' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete: set active to false
    const grupo = await db.grupoWhatsapp.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json(grupo)
  } catch (error) {
    console.error('Error deleting grupo whatsapp:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir grupo' },
      { status: 500 }
    )
  }
}
