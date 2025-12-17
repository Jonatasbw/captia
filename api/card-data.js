export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { portalId, userId, userEmail, associatedObjectId, associatedObjectType } = req.body;

  console.log('[CARD] Request received:', { portalId, userId, associatedObjectId });

  try {
    // Buscar quota do usuário
    const quotaResponse = await fetch('https://captia.vercel.app/api/check-quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: portalId || 'default' })
    });

    let quotaData = { summariesUsed: 0, summariesRemaining: 5, isPro: false };
    
    if (quotaResponse.ok) {
      quotaData = await quotaResponse.json();
    }

    // Retornar dados para o card
    return res.json({
      results: [
        {
          objectId: associatedObjectId,
          title: "Captia AI Summary",
          link: `https://captia.vercel.app/card.html?contactId=${associatedObjectId}&portalId=${portalId}`,
          properties: [
            {
              label: "Summaries Used",
              dataType: "STATUS",
              value: `${quotaData.summariesUsed} of ${quotaData.isPro ? '∞' : '5'}`
            },
            {
              label: "Remaining",
              dataType: "STATUS", 
              value: quotaData.isPro ? 'Unlimited' : `${quotaData.summariesRemaining} left`
            },
            {
              label: "Plan",
              dataType: "STATUS",
              value: quotaData.isPro ? 'PRO ⭐' : 'Free'
            }
          ],
          actions: [
            {
              type: "IFRAME",
              width: 890,
              height: 748,
              uri: `https://captia.vercel.app/card.html?contactId=${associatedObjectId}&portalId=${portalId}`,
              label: "Generate AI Summary",
              associatedObjectProperties: []
            }
          ]
        }
      ]
    });

  } catch (error) {
    console.error('[CARD ERROR]', error);
    return res.status(500).json({ 
      error: 'Failed to fetch card data',
      details: error.message 
    });
  }
}
