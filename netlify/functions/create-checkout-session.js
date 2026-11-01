/**
 * Netlify Serverless Function: create-checkout-session.js
 * Ubicación automática para Netlify: /netlify/functions/create-checkout-session.js
 *
 * Variables de entorno requeridas en el panel de Netlify (Site configuration > Environment variables):
 *   STRIPE_SECRET_KEY = sk_live_... (o sk_test_... para hacer pruebas gratis)
 */

const CATALOG_PRODUCTS = {
  starter_pack: {
    name: 'Pack de Inicio Comandante (-70% DTO) - Tanks Arena 3D',
    description: 'Incluye Skin Dragón de Magma 3D + 300 Gemas de Plasma + 2.500 Monedas + Corona Imperial 3D',
    amountCents: 199, // 1.99 EUR
    currency: 'eur'
  },
  battle_pass_vip: {
    name: 'Pase de Batalla VIP (Temporada 1) - Tanks Arena 3D',
    description: 'Desbloquea las 10 recompensas Élite, Skin Mecha Evangelion Ω, Trazadora Solar y +25% Oro/XP',
    amountCents: 499, // 4.99 EUR
    currency: 'eur'
  },
  gems_handful: {
    name: 'Bolsa de 250 Gemas de Plasma - Tanks Arena 3D',
    description: '250 Gemas de Plasma para skins, cascos 3D, efectos de disparo y cofres',
    amountCents: 199, // 1.99 EUR
    currency: 'eur'
  },
  gems_chest: {
    name: 'Cofre de 800 Gemas de Plasma (+25% Bonus) - Tanks Arena 3D',
    description: '800 Gemas de Plasma para desbloquear cosméticos míticos y cofres del taller',
    amountCents: 499, // 4.99 EUR
    currency: 'eur'
  },
  gems_vault: {
    name: 'Cámara Acorazada de 2.200 Gemas + Skin Diamante Real - Tanks Arena 3D',
    description: '2.200 Gemas de Plasma + Skin Diamante Prisma Real 3D + 5.000 Monedas de Oro',
    amountCents: 999, // 9.99 EUR
    currency: 'eur'
  },
  coffee_support: {
    name: 'Apoyo Voluntario al Desarrollador (Café Táctico)',
    description: 'Apoyo indie para nuevos biomas y misiones + Aureola 3D + 300 Gemas + Insignia Mecenas',
    amountCents: 299, // 2.99 EUR
    currency: 'eur'
  }
};

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
    const { productId, playerId, customerEmail } = JSON.parse(event.body || '{}');
    const product = CATALOG_PRODUCTS[productId];

    if (!product) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Producto no válido en el catálogo' })
      };
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const originHeader = event.headers?.origin || event.headers?.Origin;
    const siteUrl = originHeader || process.env.URL || 'http://localhost:3000';

    // Si aún no se ha configurado STRIPE_SECRET_KEY en Netlify, devolvemos modo simulación seguro
    if (!stripeSecretKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'demo_simulation',
          productId,
          checkoutUrl: `${siteUrl}/?purchase_success=true&product=${encodeURIComponent(productId)}`
        })
      };
    }

    // Llamada directa a la API REST de Stripe Checkout (sin necesitar instalar paquetes externos)
    const params = new URLSearchParams();
    params.append('payment_method_types[]', 'card');
    params.append('mode', 'payment');
    params.append('success_url', `${siteUrl}/?purchase_success=true&product=${encodeURIComponent(productId)}&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${siteUrl}/?purchase_canceled=true`);
    params.append('client_reference_id', playerId || 'anonymous_commander');
    params.append('metadata[productId]', productId);

    if (customerEmail && typeof customerEmail === 'string' && customerEmail.includes('@')) {
      params.append('customer_email', customerEmail.trim());
    }

    params.append('line_items[0][price_data][currency]', product.currency);
    params.append('line_items[0][price_data][unit_amount]', String(product.amountCents));
    params.append('line_items[0][price_data][product_data][name]', product.name);
    params.append('line_items[0][price_data][product_data][description]', product.description);
    params.append('line_items[0][quantity]', '1');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: session.error?.message || 'Error al crear sesión de Stripe' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        mode: 'live_stripe',
        sessionId: session.id,
        checkoutUrl: session.url
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
