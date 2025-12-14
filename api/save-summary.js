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
    // Chamar OpenAI para gerar resumo
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
            content: `You are a professional meeting summarizer. Analyze the meeting transcript and create a structured summary in Portuguese (Brazil).

Format the summary EXACTLY like this:

🎯 RESUMO DA REUNIÃO
- Objetivo: [main goal of the meeting]
- Pontos principais discutidos: [2-3 key discussion points]
- Dores/problemas do cliente: [pain points mentioned]
- Objeções/preocupações: [any concerns raised]
- Decisões tomadas: [decisions made]

✅ PRÓXIMOS PASSOS
- Ações: [action items with owner if mentioned]
- Responsável: [who is responsible]
- Prazo: [deadline if mentioned]

📋 DETALHES IMPORTANTES
- Orçamento: [budget discussed]
- Timeline: [timeline mentioned]
- Produtos/serviços: [products or services discussed]
- Outras notas: [other relevant info]

Be concise but informative. If information is not mentioned in the transcript, write "Não mencionado" for that field.`
          },
          {
            role: "user",
            content: `Analise esta transcrição de reunião e crie um resumo estruturado:

${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      console.error("OpenAI error:", error);
      return res.status(500).json({ error: "Failed to generate summary with AI" });
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices[0].message.content;

    // Formatar resumo final
    const finalSummary = `📊 CAPTIA AI MEETING SUMMARY

${aiSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TRANSCRIÇÃO ORIGINAL
${transcript}`;

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
