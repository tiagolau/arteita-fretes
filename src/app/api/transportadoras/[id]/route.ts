import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const transportadora = await db.transportadora.findUnique({
      where: { id: params.id },
    })

    if (!transportadora) {
      return NextResponse.json(
        { error: 'Transportadora não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(transportadora)
  } catch (error) {
    console.error('Error fetching transportadora:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar transportadora' },
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
    const { razaoSocial, cnpj, contato, telefone } = body

    const transportadora = await db.transportadora.update({
      where: { id: params.id },
      data: {
        ...(razaoSocial !== undefined && { razaoSocial }),
        ...(cnpj !== undefined && { cnpj }),
        ...(contato !== undefined && { contato }),
        ...(telefone !== undefined && { telefone }),
      },
    })

    return NextResponse.json(transportadora)
  } catch (error) {
    console.error('Error updating transportadora:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar transportadora' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const transportadora = await db.transportadora.update({
      where: { id: params.id },
      data: { active: false },
    })

    return NextResponse.json(transportadora)
  } catch (error) {
    console.error('Error deleting transportadora:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir transportadora' },
      { status: 500 }
    )
  }
}
