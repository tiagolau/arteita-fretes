import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const caminhao = await db.caminhao.findUnique({
      where: { id: params.id },
    })

    if (!caminhao) {
      return NextResponse.json(
        { error: 'Caminhão não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(caminhao)
  } catch (error) {
    console.error('Error fetching caminhao:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar caminhão' },
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
    const { placa, modelo, capacidade } = body

    const caminhao = await db.caminhao.update({
      where: { id: params.id },
      data: {
        ...(placa !== undefined && { placa }),
        ...(modelo !== undefined && { modelo }),
        ...(capacidade !== undefined && { capacidade }),
      },
    })

    return NextResponse.json(caminhao)
  } catch (error) {
    console.error('Error updating caminhao:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar caminhão' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const caminhao = await db.caminhao.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json(caminhao)
  } catch (error) {
    console.error('Error deleting caminhao:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir caminhão' },
      { status: 500 }
    )
  }
}
