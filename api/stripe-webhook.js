import Stripe from 'stripe';
import admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verificar assinatura do webhook
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[STRIPE WEBHOOK] Event received:', event.type);

  // Processar eventos
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId || session.client_reference_id;

        console.log('[STRIPE WEBHOOK] Payment successful for userId:', userId);

        // Ativar PRO no Firebase
        await db.collection('users').doc(userId).set(
          {
            isPro: true,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            upgradedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        console.log('[STRIPE WEBHOOK] User upgraded to PRO:', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log('[STRIPE WEBHOOK] Subscription canceled for customer:', customerId);

        // Buscar usuário pelo customerId
        const usersSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .get();

        if (!usersSnapshot.empty) {
          const userId = usersSnapshot.docs[0].id;
          
          // Desativar PRO
          await db.collection('users').doc(userId).update({
            isPro: false,
            canceledAt: new Date().toISOString(),
          });

          console.log('[STRIPE WEBHOOK] User downgraded from PRO:', userId);
        }
        break;
      }

      default:
        console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
    }

    return res.json({ received: true });

  } catch (error) {
    console.error('[STRIPE WEBHOOK ERROR]', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}
