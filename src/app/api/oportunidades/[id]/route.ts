import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const oportunidade = await db.oportunidade.findUnique({
      where: { id: params.id },
      include: {
        grupo: true,
      },
    })

    if (!oportunidade) {
      return NextResponse.json(
        { error: 'Oportunidade nao encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(oportunidade)
  } catch (error) {
    console.error('Error fetching oportunidade:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar oportunidade' },
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
    const {
      status,
      prioridade,
      tipoCarga,
      origem,
      destino,
      tonelagem,
      precoOferecido,
      urgencia,
      contato,
      expiresAt,
    } = body

    const oportunidade = await db.oportunidade.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(prioridade !== undefined && { prioridade }),
        ...(tipoCarga !== undefined && { tipoCarga }),
        ...(origem !== undefined && { origem }),
        ...(destino !== undefined && { destino }),
        ...(tonelagem !== undefined && { tonelagem: tonelagem !== null ? parseFloat(tonelagem) : null }),
        ...(precoOferecido !== undefined && { precoOferecido: precoOferecido !== null ? parseFloat(precoOferecido) : null }),
        ...(urgencia !== undefined && { urgencia }),
        ...(contato !== undefined && { contato }),
        ...(expiresAt !== undefined && { expiresAt: new Date(expiresAt) }),
      },
      include: {
        grupo: true,
      },
    })

    return NextResponse.json(oportunidade)
  } catch (error) {
    console.error('Error updating oportunidade:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar oportunidade' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await db.oportunidade.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Oportunidade excluida com sucesso' })
  } catch (error) {
    console.error('Error deleting oportunidade:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir oportunidade' },
      { status: 500 }
    )
  }
}
