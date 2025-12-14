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

  const summary = `
MEETING SUMMARY
- Objective:
- Key discussion points:
- Client pain points:
- Objections / concerns:
- Decisions made:

NEXT STEPS
- Action items:
- Owner:
- Deadline:

IMPORTANT DETAILS
- Budget:
- Timeline:
- Products / services mentioned:
- Other notes:

RAW TRANSCRIPT
${transcript || "(no transcript provided)"}
`.trim();

  try {
    const updateRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            captia_ai_summary: summary
          }
        })
      }
    );

    if (!updateRes.ok) {
      const error = await updateRes.json();
      return res.status(400).json(error);
    }

    const result = await updateRes.json();

    res.json({
      status: "ok",
      message: "Summary saved to contact",
      contactId: result.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
}
