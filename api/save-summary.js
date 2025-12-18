import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, contactId, transcript, source, accessToken } = req.body;

    if (!userId || !transcript) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and transcript' 
      });
    }

    console.log('[SAVE-SUMMARY] Request:', { 
      userId, 
      contactId, 
      source: source || 'unknown',
      transcriptLength: transcript.length 
    });

    // Check quota
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    let summariesUsed = 0;
    let isPro = false;

    if (userDoc.exists) {
      const userData = userDoc.data();
      summariesUsed = userData.summariesUsed || 0;
      isPro = userData.isPro || false;
      
      console.log('[SAVE-SUMMARY] User found:', { summariesUsed, isPro });
    } else {
      console.log('[SAVE-SUMMARY] New user, will be created');
    }

    // Block if exceeded limit and not PRO
    const FREE_LIMIT = 5;
    if (!isPro && summariesUsed >= FREE_LIMIT) {
      console.log('[SAVE-SUMMARY] User reached free limit');
      return res.status(403).json({
        error: "Free limit reached",
        message: "You've used all 5 free analyses. Upgrade to Pro for unlimited analyses.",
        summariesUsed: summariesUsed,
        needsUpgrade: true,
        upgradeUrl: "https://captia.vercel.app/#pricing"
      });
    }

    console.log('[SAVE-SUMMARY] Calling OpenAI API...');

    // Call OpenAI to generate strategic analysis
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
            content: `You are an expert B2B sales strategist and deal analyst. Your job is to analyze sales conversation transcripts and extract STRATEGIC intelligence that helps close deals.

Focus on identifying:
1. BUDGET: Real budget (not just what they say), who controls it, financial constraints
2. DECISION PROCESS: Who decides, who has veto power, approval process
3. TIMELINE: Real timeline (not just target date), urgency level, deadline drivers
4. PAIN POINTS: Specific problems, impact on business, cost of inaction
5. COMPETITIVE LANDSCAPE: Other solutions being evaluated, why they're looking
6. RISKS: Red flags, objections, concerns that could kill the deal
7. BUYING SIGNALS: Signs they're ready to buy or just exploring
8. NEXT ACTIONS: Specific strategic moves to advance the deal

CRITICAL RULES:
- Be EXTREMELY objective - if info isn't in transcript, say "Not mentioned"
- Focus on what will help CLOSE THE DEAL, not just summarize
- Identify subtle signals (hesitation, vague answers, enthusiasm)
- Flag risks early - better to know now than be surprised later
- Provide ACTIONABLE next steps, not generic advice

OUTPUT FORMAT:

🎯 EXECUTIVE SUMMARY
• **Meeting Type:** [Discovery/Demo/Negotiation/Follow-up/Other]
• **Deal Stage:** [Early/Qualified/Proposal/Negotiation/Closing]
• **Overall Sentiment:** [Very Positive/Positive/Neutral/Concerned/Negative]
• **Key Takeaway:** [One sentence - most important insight]

💰 BUDGET & FINANCIALS
• **Mentioned Budget:** [Amount or "Not discussed"]
• **Real Budget Signal:** [Analysis of actual budget based on context]
• **Budget Holder:** [Who controls the money]
• **Financial Constraints:** [Any limitations mentioned]
• **Urgency:** [High/Medium/Low - Why?]

👥 DECISION MAKERS & STAKEHOLDERS
• **Primary Contact:** [Name/role if mentioned]
• **Economic Buyer:** [Who signs the check]
• **Decision Maker:** [Who makes final call]
• **Influencers:** [Who else is involved]
• **Approval Process:** [Steps needed to close]

📅 TIMELINE & URGENCY
• **Target Start Date:** [When they want to begin]
• **Decision Timeline:** [When they'll decide]
• **Urgency Drivers:** [Why this timeline / What's pushing them]
• **Deal Velocity:** [Fast/Normal/Slow - Why?]

🎯 PAIN POINTS & VALUE
• **Primary Pain:** [Main problem they're solving]
• **Business Impact:** [How this problem affects them]
• **Current Situation:** [What they're doing now]
• **Desired Outcome:** [What success looks like]

⚔️ COMPETITIVE LANDSCAPE
• **Competitors Mentioned:** [List or "None mentioned"]
• **Why Evaluating:** [Reason for looking at solutions]
• **Differentiators Discussed:** [What matters to them]
• **Objections to Competitors:** [If any mentioned]

🚨 RISKS & RED FLAGS
• **Major Risks:** [Things that could kill this deal]
• **Objections Raised:** [Concerns they expressed]
• **Hesitation Points:** [Where they seemed unsure]
• **Missing Information:** [Critical unknowns]

✅ BUYING SIGNALS
• **Positive Indicators:** [Signs they want to buy]
• **Engagement Level:** [How interested they seemed]
• **Questions Asked:** [What they wanted to know]
• **Next Steps They Proposed:** [If any]

📊 DEAL SCORE: [0-100]
**Probability to Close:** [High 70-100 / Medium 40-69 / Low 0-39]
**Justification:** [2-3 sentences explaining the score based on:
- Budget clarity and availability
- Decision process clarity
- Timeline and urgency
- Pain severity and fit
- Competitive position
- Engagement level]

🎯 STRATEGIC NEXT STEPS
**Immediate (Within 24-48 hours):**
1. [Specific action with why]
2. [Specific action with why]

**Short-term (This week):**
1. [Specific action with why]

**Risks to Address:**
1. [Specific risk and how to mitigate]

💡 SALES COACH INSIGHTS
• **What Went Well:** [1-2 things done right]
• **What to Improve:** [1-2 areas for improvement]
• **Strategic Advice:** [1-2 key recommendations]

---

Be concise but thorough. Every insight should be ACTIONABLE.`
          },
          {
            role: "user",
            content: `Analyze this sales conversation and provide strategic intelligence:

TRANSCRIPT:
${transcript}

${source ? `\nSOURCE: ${source}` : ''}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[SAVE-SUMMARY] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices[0].message.content;
    
    console.log('[SAVE-SUMMARY] AI analysis generated, length:', summary.length);

    // Save to HubSpot timeline (if accessToken provided)
    if (accessToken && accessToken !== 'PLACEHOLDER_HANDLED_BY_BACKEND' && contactId) {
      try {
        console.log('[SAVE-SUMMARY] Saving to HubSpot...');
        
        const noteResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/notes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: {
                hs_timestamp: Date.now(),
                hs_note_body: `📊 CAPTIA SALES INTELLIGENCE ANALYSIS\n\nGenerated: ${new Date().toLocaleString()}\n${source ? `Source: ${source}\n` : ''}\n\n${summary}`,
                hubspot_owner_id: null
              },
              associations: [
                {
                  to: { id: contactId },
                  types: [{ 
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 202 
                  }]
                }
              ]
            })
          }
        );

        if (noteResponse.ok) {
          console.log('[SAVE-SUMMARY] Successfully saved to HubSpot');
        } else {
          const errorText = await noteResponse.text();
          console.error('[SAVE-SUMMARY] HubSpot save failed:', errorText);
        }
      } catch (hubspotError) {
        console.error('[SAVE-SUMMARY] HubSpot error:', hubspotError);
        // Don't fail the whole request if HubSpot save fails
      }
    }

    // Increment usage counter in Firebase
    if (userDoc.exists) {
      await userRef.update({
        summariesUsed: admin.firestore.FieldValue.increment(1),
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[SAVE-SUMMARY] Incremented counter to:', summariesUsed + 1);
    } else {
      await userRef.set({
        summariesUsed: 1,
        isPro: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[SAVE-SUMMARY] Created new user with count: 1');
    }

    return res.status(200).json({
      status: "success",
      message: "Strategic analysis generated and saved",
      summary: summary,
      summariesUsed: summariesUsed + 1,
      summariesRemaining: isPro ? 'unlimited' : Math.max(0, FREE_LIMIT - (summariesUsed + 1)),
      tokensUsed: aiData.usage?.total_tokens || 0,
      source: source || 'unknown'
    });

  } catch (error) {
    console.error('[SAVE-SUMMARY] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
