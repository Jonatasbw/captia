export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { accessToken, contactId, transcript } = req.body;

  if (!accessToken || !contactId) {
    return res.status(400).json({ 
      error: "Missing required fields: accessToken and contactId" 
    });
  }

  // Formato do resumo
  const summary = `
📊 CAPTIA AI MEETING SUMMARY

🎯 MEETING SUMMARY
- Objective:
- Key discussion points:
- Client pain points:
- Objections / concerns:
- Decisions made:

✅ NEXT STEPS
- Action items:
- Owner:
- Deadline:

📋 IMPORTANT DETAILS
- Budget:
- Timeline:
- Products / services mentioned:
- Other notes:

📝 RAW TRANSCRIPT
${transcript || "(no transcript provided)"}
`.trim();

  try {
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
            body: summary
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
      message: "Summary saved to timeline",
      engagementId: result.engagement.id,
      contactId: contactId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}
