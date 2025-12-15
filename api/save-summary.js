export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { accessToken, contactId, transcript } = req.body;

  if (!accessToken || !contactId || !transcript) {
    return res.status(400).json({ 
      error: "Missing required fields: accessToken, contactId, and transcript" 
    });
  }

  try {
    // Chamar OpenAI para gerar resumo inteligente
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em vendas B2B que analisa transcrições de reuniões e cria resumos executivos acionáveis.

INSTRUÇÕES CRÍTICAS:
- Seja EXTREMAMENTE objetivo e direto
- Identifique APENAS informações explicitamente mencionadas
- Use linguagem profissional de vendas
- Destaque PAIN POINTS específicos do cliente
- Identifique SINAIS DE COMPRA e OBJEÇÕES claramente
- Sugira PRÓXIMOS PASSOS estratégicos baseados na conversa
- Se algo não foi mencionado, escreva "Não mencionado"

FORMATO OBRIGATÓRIO:

🎯 RESUMO EXECUTIVO
- **Tipo de reunião:** [Discovery/Demo/Negociação/Follow-up]
- **Objetivo principal:** [1 frase clara]
- **Resultado:** [Positivo/Neutro/Precisa atenção - 1 frase]

💼 CONTEXTO DO CLIENTE
- **Empresa/Segmento:** [se mencionado]
- **Dor principal:** [problema específico que o cliente quer resolver]
- **Impacto do problema:** [consequências mencionadas]
- **Urgência:** [Alta/Média/Baixa - baseado no tom]

💰 OPORTUNIDADE
- **Orçamento:** [valor mencionado ou "Não discutido"]
- **Timeline:** [quando querem começar]
- **Decisores:** [quem participa da decisão]
- **Concorrentes:** [se mencionado algum]

🚨 OBJEÇÕES E RISCOS
- [Liste cada objeção específica mencionada]
- [Se não houver, escreva "Nenhuma objeção levantada"]

✅ PRÓXIMOS PASSOS
- **Imediato:** [o que foi acordado para fazer agora]
- **Prazo:** [data/período específico]
- **Responsável:** [quem vai fazer - cliente ou vendedor]

🎲 PROBABILIDADE DE FECHAMENTO
- **Score:** [Alto/Médio/Baixo]
- **Justificativa:** [1 frase explicando o score]

💡 RECOMENDAÇÕES ESTRATÉGICAS
- [2-3 ações específicas que o vendedor deve tomar baseado na conversa]

Seja conciso. Máximo 2-3 linhas por seção.`
          },
          {
            role: "user",
            content: `Analise esta transcrição de reunião de vendas e crie um resumo executivo acionável:

${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      console.error("OpenAI error:", error);
      return res.status(500).json({ error: "Failed to generate summary with AI" });
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices[0].message.content;

    // Formatar resumo final com cabeçalho profissional
    const finalSummary = `📊 CAPTIA AI MEETING SUMMARY
Generated on ${new Date().toLocaleDateString('pt-BR', { 
  day: '2-digit', 
  month: 'long', 
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

${aiSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TRANSCRIÇÃO COMPLETA
${transcript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Captia AI | captia.com`;

    // Criar engagement/nota na timeline
    const engagementRes = await fetch(
      "https://api.hubapi.com/engagements/v1/engagements",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          engagement: {
            active: true,
            type: "NOTE",
            timestamp: Date.now()
          },
          associations: {
            contactIds: [parseInt(contactId)]
          },
          metadata: {
            body: finalSummary
          }
        })
      }
    );

    if (!engagementRes.ok) {
      const error = await engagementRes.json();
      return res.status(400).json(error);
    }

    const result = await engagementRes.json();

    res.json({
      status: "ok",
      message: "AI summary saved to timeline",
      engagementId: result.engagement.id,
      contactId: contactId,
      tokensUsed: aiData.usage.total_tokens,
      cost: `~$${(aiData.usage.total_tokens / 1000000 * 0.15).toFixed(4)}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}
