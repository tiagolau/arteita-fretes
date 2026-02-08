import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const motorista = await db.motorista.findUnique({
      where: { id: params.id },
    })

    if (!motorista) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(motorista)
  } catch (error) {
    console.error('Error fetching motorista:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar motorista' },
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
    const { nome, cnh, telefone, whatsapp } = body

    const motorista = await db.motorista.update({
      where: { id: params.id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(cnh !== undefined && { cnh }),
        ...(telefone !== undefined && { telefone }),
        ...(whatsapp !== undefined && { whatsapp }),
      },
    })

    return NextResponse.json(motorista)
  } catch (error) {
    console.error('Error updating motorista:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar motorista' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const motorista = await db.motorista.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json(motorista)
  } catch (error) {
    console.error('Error deleting motorista:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir motorista' },
      { status: 500 }
    )
  }
}
