import admin from 'firebase-admin';

// Inicializar Firebase Admin (apenas uma vez)
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
  // CRM Cards sempre usam POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[CARD-DATA] Request body:', JSON.stringify(req.body, null, 2));

    // HubSpot envia os dados do contato no body
    const {
      userEmail,
      associatedObjectId,
      associatedObjectType,
      portalId
    } = req.body;

    console.log('[CARD-DATA] Contact email:', userEmail);
    console.log('[CARD-DATA] Contact ID:', associatedObjectId);

    // Se não tiver email, retornar card vazio
    if (!userEmail) {
      return res.json({
        results: [{
          objectId: associatedObjectId,
          title: "No Email",
          properties: [
            {
              label: "Status",
              dataType: "STRING",
              value: "Email not found for this contact"
            }
          ]
        }]
      });
    }

    // Buscar dados do usuário no Firebase
    const userDoc = await db.collection('users').doc(userEmail).get();

    let summariesUsed = 0;
    let isPro = false;
    let remaining = 5;

    if (userDoc.exists) {
      const userData = userDoc.data();
      summariesUsed = userData.summariesUsed || 0;
      isPro = userData.isPro || false;
      remaining = isPro ? '∞' : Math.max(0, 5 - summariesUsed);

      console.log('[CARD-DATA] User found:', {
        email: userEmail,
        summariesUsed,
        isPro,
        remaining
      });
    } else {
      console.log('[CARD-DATA] User not found, showing default values');
    }

    // Retornar dados no formato esperado pelo HubSpot
    return res.json({
      results: [{
        objectId: associatedObjectId,
        title: isPro ? "🚀 Pro User" : "🆓 Free User",
        properties: [
          {
            label: "Summaries Used",
            dataType: "STRING",
            value: String(summariesUsed)
          },
          {
            label: "Remaining",
            dataType: "STRING",
            value: String(remaining)
          },
          {
            label: "Plan",
            dataType: "STRING",
            value: isPro ? "PRO ($15/mo)" : "FREE (5 summaries)"
          }
        ],
        actions: [
          {
            type: "IFRAME",
            width: 800,
            height: 600,
            uri: `https://captia.vercel.app/card.html?email=${encodeURIComponent(userEmail)}`,
            label: "Generate Summary"
          }
        ]
      }]
    });

  } catch (error) {
    console.error('[CARD-DATA] Error:', error);
    
    // Retornar erro formatado para o HubSpot
    return res.status(200).json({
      results: [{
        objectId: req.body.associatedObjectId || '0',
        title: "Error Loading Data",
        properties: [
          {
            label: "Status",
            dataType: "STRING",
            value: error.message
          }
        ]
      }]
    });
  }
}
