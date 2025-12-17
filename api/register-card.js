export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.HUBSPOT_APP_ID;
  const developerApiKey = process.env.HUBSPOT_DEVELOPER_KEY;

  if (!appId || !developerApiKey) {
    return res.status(500).json({ 
      error: 'Missing HUBSPOT_APP_ID or HUBSPOT_DEVELOPER_KEY environment variables' 
    });
  }

  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/extensions/cards/${appId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${developerApiKey}`
        },
        body: JSON.stringify({
          title: "Captia AI Summary",
          fetch: {
            targetUrl: "https://captia.vercel.app/api/card-data",
            objectTypes: [
              {
                name: "contacts",
                propertiesToSend: ["firstname", "lastname", "email"]
              }
            ]
          },
          display: {
            properties: [
              {
                name: "summariesUsed",
                label: "Summaries Used",
                dataType: "STRING"
              },
              {
                name: "remaining",
                label: "Remaining", 
                dataType: "STRING"
              },
              {
                name: "plan",
                label: "Plan",
                dataType: "STRING"
              }
            ]
          },
          actions: {
            baseUrls: ["https://captia.vercel.app"]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    return res.json({ 
      success: true,
      message: 'CRM Card registered successfully',
      data 
    });

  } catch (error) {
    console.error('[REGISTER CARD ERROR]', error);
    return res.status(500).json({ 
      error: 'Failed to register card',
      details: error.message 
    });
  }
}
