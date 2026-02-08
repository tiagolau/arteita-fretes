import { db } from '../db'
import { classifyOpportunity } from '../ai/extract-freight'
import type { OportunidadePrioridade } from '@prisma/client'

function mapPriority(priority: string): OportunidadePrioridade {
  const upper = priority?.toUpperCase() || 'MEDIA'
  if (upper === 'ALTA' || upper === 'HIGH') return 'ALTA'
  if (upper === 'BAIXA' || upper === 'LOW') return 'BAIXA'
  return 'MEDIA'
}

export async function processGroupMessage(
  groupId: string,
  senderNumber: string,
  messageText: string
): Promise<void> {
  try {
    // Look up the group in database
    const grupo = await db.grupoWhatsapp.findUnique({
      where: { grupoId: groupId },
    })

    // If group not found or not active, return silently
    if (!grupo || !grupo.active) {
      return
    }

    const keywords = grupo.palavrasChave || []

    // Quick pre-filter: check if message contains any keyword (case-insensitive)
    // Skip AI processing if no keywords match to save costs
    if (keywords.length > 0) {
      const lowerMessage = messageText.toLowerCase()
      const hasKeyword = keywords.some((keyword) =>
        lowerMessage.includes(keyword.toLowerCase())
      )

      if (!hasKeyword) {
        return
      }
    }

    // Load preferred routes from active OrigemDestino entries
    const activeRoutes = await db.origemDestino.findMany({
      where: { active: true },
      select: { nome: true },
    })
    const preferredRoutes = activeRoutes.map((r) => r.nome)

    // Classify with AI
    const result = await classifyOpportunity(messageText, {
      keywords,
      preferredRoutes,
      minPricePerTon: 0,
    })

    if (result.isOpportunity) {
      // Create Oportunidade record with 48-hour expiry
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 48)

      const oportunidade = await db.oportunidade.create({
        data: {
          grupoId: grupo.id,
          mensagemOriginal: messageText,
          tipoCarga: result.tipoCarga || null,
          origem: result.origem || null,
          destino: result.destino || null,
          tonelagem: result.tonelagem || null,
          precoOferecido: result.precoOferecido || null,
          urgencia: result.urgencia || null,
          contato: result.contato || senderNumber || null,
          prioridade: mapPriority(result.prioridade || 'MEDIA'),
          status: 'NOVA',
          expiresAt,
        },
      })

      console.log(
        '[GROUP MONITOR] Nova oportunidade detectada:',
        JSON.stringify({
          id: oportunidade.id,
          grupo: grupo.nome,
          tipoCarga: result.tipoCarga,
          origem: result.origem,
          destino: result.destino,
          prioridade: oportunidade.prioridade,
        })
      )
    }
  } catch (error) {
    console.error('[GROUP MONITOR] Error processing group message:', error)
    // Return silently — never send messages to groups automatically
  }
}
