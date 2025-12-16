import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, userEmail } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // DEBUG: Verificar se a chave existe
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    return res.status(500).json({ 
      error: 'STRIPE_SECRET_KEY not configured',
      hint: 'Check Vercel environment variables'
    });
  }

  console.log('[STRIPE] Secret key exists:', !!secretKey);
  console.log('[STRIPE] Secret key starts with:', secretKey.substring(0, 15));
  console.log('[STRIPE] Secret key length:', secretKey.length);

  try {
    const stripe = new Stripe(secretKey);
    
    console.log('[STRIPE] Creating checkout session for userId:', userId);

    // Criar sessão de checkout do Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `https://captia.vercel.app/?success=true`,
      cancel_url: `https://captia.vercel.app/?canceled=true`,
      client_reference_id: userId,
      customer_email: userEmail || undefined,
      metadata: {
        userId: userId,
      },
    });

    console.log('[STRIPE] Checkout session created:', session.id);

    return res.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('[STRIPE ERROR]', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
}
