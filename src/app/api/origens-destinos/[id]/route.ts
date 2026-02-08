import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const origemDestino = await db.origemDestino.findUnique({
      where: { id: params.id },
    })

    if (!origemDestino) {
      return NextResponse.json(
        { error: 'Origem/Destino não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(origemDestino)
  } catch (error) {
    console.error('Error fetching origem/destino:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar origem/destino' },
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
    const { nome, cidade, uf } = body

    const origemDestino = await db.origemDestino.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(cidade !== undefined && { cidade }),
        ...(uf !== undefined && { uf }),
      },
    })

    return NextResponse.json(origemDestino)
  } catch (error) {
    console.error('Error updating origem/destino:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar origem/destino' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const origemDestino = await db.origemDestino.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json(origemDestino)
  } catch (error) {
    console.error('Error deleting origem/destino:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir origem/destino' },
      { status: 500 }
    )
  }
}
