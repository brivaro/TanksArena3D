/**
 * Netlify Serverless Function: /netlify/functions/verify-purchase.js
 */

function getStripeKey() {
  const raw =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_KEY ||
    process.env.VITE_STRIPE_SECRET_KEY ||
    '';
  return raw.trim().replace(/^["']|["']$/g, '');
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { email, sessionId } = JSON.parse(event.body || '{}');
    const stripeSecretKey = getStripeKey();

    if (!stripeSecretKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'demo_local',
          verified: true,
          message: 'Modo Previsualización: Las compras se guardan en localStorage y en tu Código de Pasaporte TK3D. Al añadir STRIPE_SECRET_KEY en Netlify y redesplegar, este botón consulta las compras reales en Stripe por Email.'
        })
      };
    }

    if (sessionId) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`
        }
      });
      const session = await response.json();
      if (!response.ok) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: session.error?.message || 'No se pudo verificar la sesión en Stripe' })
        };
      }

      const paid = session.payment_status === 'paid';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'live_stripe',
          verified: paid,
          productId: session.metadata?.productId || null,
          customerEmail: session.customer_details?.email || null
        })
      };
    }

    if (email) {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: data.error?.message || 'Error al consultar Stripe (revisa permisos de lectura de Checkout Sessions en tu clave rk_live)' })
        };
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const purchasedProducts = (data.data || [])
        .filter((s) => s.payment_status === 'paid' && (
          s.customer_details?.email?.toLowerCase() === normalizedEmail ||
          s.customer_email?.toLowerCase() === normalizedEmail
        ))
        .map((s) => s.metadata?.productId)
        .filter(Boolean);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'live_stripe',
          verified: purchasedProducts.length > 0,
          purchasedProducts
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Falta email o sessionId' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
