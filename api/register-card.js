export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.HUBSPOT_APP_ID;
  const developerKey = process.env.HUBSPOT_DEVELOPER_KEY;

  if (!appId || !developerKey) {
    console.error('[REGISTER-CARD] Missing variables:', {
      hasAppId: !!appId,
      hasDeveloperKey: !!developerKey
    });
    return res.status(500).json({ 
      error: 'Missing HUBSPOT_APP_ID or HUBSPOT_DEVELOPER_KEY environment variables' 
    });
  }

  try {
    console.log('[REGISTER-CARD] Registering card for App ID:', appId);

    // Usar hapikey como query parameter (método antigo mas ainda funciona)
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/extensions/cards/${appId}?hapikey=${developerKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

    const responseText = await response.text();
    console.log('[REGISTER-CARD] HubSpot response status:', response.status);
    console.log('[REGISTER-CARD] HubSpot response:', responseText);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to register card',
        details: responseText
      });
    }

    const data = JSON.parse(responseText);
    console.log('[REGISTER-CARD] Card registered successfully! ID:', data.id);

    return res.json({ 
      success: true,
      message: 'CRM Card registered successfully',
      cardId: data.id,
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
