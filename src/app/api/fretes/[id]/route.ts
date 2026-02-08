import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const frete = await db.frete.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      include: {
        origem: true,
        destino: true,
        transportadora: true,
        caminhao: true,
        motorista: true,
      },
    })

    if (!frete) {
      return NextResponse.json(
        { error: 'Frete não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(frete)
  } catch (error) {
    console.error('Error fetching frete:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar frete' },
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
      data,
      origemId,
      destinoId,
      toneladas,
      precoTonelada,
      transportadoraId,
      ticketNota,
      caminhaoId,
      motoristaId,
      observacao,
      status,
    } = body

    // Build update data dynamically
    const updateData: any = {}

    if (data !== undefined) updateData.data = new Date(data)
    if (origemId !== undefined) updateData.origemId = origemId
    if (destinoId !== undefined) updateData.destinoId = destinoId
    if (toneladas !== undefined) updateData.toneladas = parseFloat(toneladas)
    if (precoTonelada !== undefined) updateData.precoTonelada = parseFloat(precoTonelada)
    if (transportadoraId !== undefined) updateData.transportadoraId = transportadoraId
    if (ticketNota !== undefined) updateData.ticketNota = ticketNota
    if (caminhaoId !== undefined) updateData.caminhaoId = caminhaoId
    if (motoristaId !== undefined) updateData.motoristaId = motoristaId
    if (observacao !== undefined) updateData.observacao = observacao
    if (status !== undefined && ['PENDENTE', 'VALIDADO', 'REJEITADO'].includes(status)) {
      updateData.status = status
    }

    // Recalculate valorTotal if toneladas or precoTonelada changed
    if (toneladas !== undefined || precoTonelada !== undefined) {
      const existing = await db.frete.findUnique({ where: { id: params.id } })
      if (!existing) {
        return NextResponse.json(
          { error: 'Frete não encontrado' },
          { status: 404 }
        )
      }
      const finalToneladas = toneladas !== undefined ? parseFloat(toneladas) : existing.toneladas
      const finalPreco = precoTonelada !== undefined ? parseFloat(precoTonelada) : existing.precoTonelada
      updateData.valorTotal = finalToneladas * finalPreco
    }

    const frete = await db.frete.update({
      where: { id: params.id },
      data: updateData,
      include: {
        origem: true,
        destino: true,
        transportadora: true,
        caminhao: true,
        motorista: true,
      },
    })

    return NextResponse.json(frete)
  } catch (error: any) {
    console.error('Error updating frete:', error)
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Frete não encontrado' },
        { status: 404 }
      )
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um frete com este Ticket/Nota' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar frete' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { deleteMotivo } = body

    if (!deleteMotivo || !deleteMotivo.trim()) {
      return NextResponse.json(
        { error: 'Motivo da exclusão é obrigatório' },
        { status: 400 }
      )
    }

    const frete = await db.frete.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        deleteMotivo: deleteMotivo.trim(),
      },
    })

    return NextResponse.json(frete)
  } catch (error: any) {
    console.error('Error deleting frete:', error)
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Frete não encontrado' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Erro ao excluir frete' },
      { status: 500 }
    )
  }
}
