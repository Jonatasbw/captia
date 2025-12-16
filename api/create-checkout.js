// Test version - simplified
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, userEmail } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Verificar variáveis
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  
  console.log('=== STRIPE DEBUG ===');
  console.log('Secret key exists:', !!secretKey);
  console.log('Secret key length:', secretKey?.length);
  console.log('Secret key first 20 chars:', secretKey?.substring(0, 20));
  console.log('Price ID:', priceId);
  console.log('===================');

  if (!secretKey) {
    return res.status(500).json({ 
      error: 'STRIPE_SECRET_KEY not found in environment'
    });
  }

  try {
    // Importar Stripe dinamicamente
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    console.log('Stripe initialized successfully');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: 'https://captia.vercel.app/?success=true',
      cancel_url: 'https://captia.vercel.app/?canceled=true',
      client_reference_id: userId,
      customer_email: userEmail || undefined,
      metadata: { userId },
    });

    console.log('Session created:', session.id);

    return res.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('STRIPE ERROR:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    
    return res.status(500).json({ 
      error: 'Failed to create checkout',
      message: error.message,
      type: error.type
    });
  }
}
