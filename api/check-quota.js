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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    // Buscar dados do usuário
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      // Usuário novo - criar com 5 resumos grátis
      await db.collection('users').doc(userId).set({
        summariesUsed: 0,
        isPro: false,
        createdAt: new Date().toISOString()
      });

      return res.json({
        canGenerate: true,
        summariesUsed: 0,
        summariesRemaining: 5,
        isPro: false,
        needsUpgrade: false
      });
    }

    const userData = userDoc.data();
    const summariesUsed = userData.summariesUsed || 0;
    const isPro = userData.isPro || false;

    // Se é PRO, pode gerar ilimitado
    if (isPro) {
      return res.json({
        canGenerate: true,
        summariesUsed: summariesUsed,
        summariesRemaining: 'unlimited',
        isPro: true,
        needsUpgrade: false
      });
    }

    // Free tier - máximo 5 resumos
    const FREE_LIMIT = 5;
    const canGenerate = summariesUsed < FREE_LIMIT;
    const summariesRemaining = Math.max(0, FREE_LIMIT - summariesUsed);

    return res.json({
      canGenerate: canGenerate,
      summariesUsed: summariesUsed,
      summariesRemaining: summariesRemaining,
      isPro: false,
      needsUpgrade: !canGenerate
    });

  } catch (error) {
    console.error('Error checking quota:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
