import admin from 'firebase-admin';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { accessToken, contactId, transcript, userId } = req.body;

  if (!accessToken || !contactId || !transcript) {
    return res.status(400).json({ 
      error: "Missing required fields: accessToken, contactId, and transcript" 
    });
  }

  if (!userId) {
    return res.status(400).json({ 
      error: "Missing userId - required for quota tracking" 
    });
  }

  try {
    console.log('[CAPTIA] Starting summary generation for userId:', userId);

    // VERIFICAR QUOTA ANTES DE GERAR
    const userDoc = await db.collection('users').doc(userId).get();
    
    let summariesUsed = 0;
    let isPro = false;

    if (userDoc.exists) {
      const userData = userDoc.data();
      summariesUsed = userData.summariesUsed || 0;
      isPro = userData.isPro || false;
      console.log('[CAPTIA] User found. Summaries used:', summariesUsed, 'isPro:', isPro);
    } else {
      console.log('[CAPTIA] New user, will be created after generating summary');
    }

    // Bloquear se excedeu limite e não é PRO
    const FREE_LIMIT = 5;
    if (!isPro && summariesUsed >= FREE_LIMIT) {
      console.log('[CAPTIA] User reached free limit');
      return res.status(403).json({
        error: "Free limit reached",
        message: "You've used all 5 free summaries. Upgrade to Pro for unlimited summaries.",
        summariesUsed: summariesUsed,
        needsUpgrade: true,
        upgradeUrl: "https://captia.vercel.app/#pricing"
      });
    }

    console.log('[CAPTIA] Calling OpenAI API...');

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
            content: `You are a professional meeting summarizer. Analyze the meeting transcript and create a structured summary.

INSTRUCTIONS:
- Be EXTREMELY objective and direct
- Identify ONLY information explicitly mentioned
- Use professional sales language
- Highlight PAIN POINTS and BUYING SIGNALS
- Identify OBJECTIONS clearly
- Suggest STRATEGIC NEXT STEPS

MANDATORY FORMAT:

🎯 EXECUTIVE SUMMARY
- **Meeting Type:** [Discovery/Demo/Negotiation/Follow-up]
- **Main Objective:** [1 clear sentence]
- **Outcome:** [Positive/Neutral/Needs attention - 1 sentence]

💼 CLIENT CONTEXT
- **Company/Segment:** [if mentioned]
- **Main Pain Point:** [specific problem client wants to solve]
- **Problem Impact:** [consequences mentioned]
- **Urgency:** [High/Medium/Low - based on tone]

💰 OPPORTUNITY
- **Budget:** [mentioned amount or "Not discussed"]
- **Timeline:** [when they want to start]
- **Decision Makers:** [who participates in decision]
- **Competitors:** [if any mentioned]

🚨 OBJECTIONS AND RISKS
- [List each specific objection mentioned]
- [If none, write "No objections raised"]

✅ NEXT STEPS
- **Immediate:** [what was agreed to do now]
- **Deadline:** [specific date/period]
- **Responsible:** [who will do - client or seller]

🎲 CLOSE PROBABILITY
- **Score:** [High/Medium/Low]
- **Justification:** [1 sentence explaining the score]

💡 STRATEGIC RECOMMENDATIONS
- [2-3 specific actions the seller should take based on the conversation]

Be concise. Maximum 2-3 lines per section.`
          },
          {
            role: "user",
            content: `Analyze this sales meeting transcript and create an actionable executive summary:

${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.json();
      console.error('[CAPTIA] OpenAI error:', error);
      return res.status(500).json({ error: "Failed to generate summary with AI" });
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices[0].message.content;

    console.log('[CAPTIA] OpenAI response received. Tokens used:', aiData.usage.total_tokens);

    // Formatar resumo final
    const finalSummary = `📊 CAPTIA AI MEETING SUMMARY
Generated on ${new Date().toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}

${aiSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FULL TRANSCRIPT
${transcript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Captia AI | captia.com`;

    console.log('[CAPTIA] Creating HubSpot engagement...');

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
      console.error('[CAPTIA] HubSpot engagement error:', error);
      return res.status(400).json(error);
    }

    const result = await engagementRes.json();
    console.log('[CAPTIA] Engagement created successfully:', result.engagement.id);

    // INCREMENTAR CONTADOR APÓS SUCESSO
    console.log('[CAPTIA] Updating user quota...');
    const userDocRef = db.collection('users').doc(userId);

    if (userDoc.exists) {
      console.log('[CAPTIA] Updating existing user...');
      await userDocRef.update({
        summariesUsed: admin.firestore.FieldValue.increment(1),
        lastUsedAt: new Date().toISOString()
      });
      console.log('[CAPTIA] User updated successfully');
    } else {
      console.log('[CAPTIA] Creating new user...');
      await userDocRef.set({
        summariesUsed: 1,
        isPro: false,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      });
      console.log('[CAPTIA] User created successfully');
    }

    // Calcular novo saldo
    const newSummariesUsed = summariesUsed + 1;
    const summariesRemaining = isPro ? 'unlimited' : Math.max(0, FREE_LIMIT - newSummariesUsed);

    console.log('[CAPTIA] New summaries used:', newSummariesUsed);
    console.log('[CAPTIA] Summaries remaining:', summariesRemaining);

    const responseData = {
      status: "ok",
      message: "AI summary saved to timeline",
      engagementId: result.engagement.id,
      contactId: contactId,
      tokensUsed: aiData.usage.total_tokens,
      cost: `~$${(aiData.usage.total_tokens / 1000000 * 0.15).toFixed(4)}`,
      summariesUsed: newSummariesUsed,
      summariesRemaining: summariesRemaining,
      isPro: isPro
    };

    console.log('[CAPTIA] Returning response:', JSON.stringify(responseData));

    return res.json(responseData);

  } catch (error) {
    console.error('[CAPTIA ERROR]', error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
}
