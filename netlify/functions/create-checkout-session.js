/**
 * Netlify Serverless Function: create-checkout-session.js
 * Ubicación automática para Netlify: /netlify/functions/create-checkout-session.js
 *
 * Soporta tanto Claves Secretas Estándar (sk_live_... / sk_test_...)
 * como Claves Restringidas (rk_live_... / rk_test_...) que tengan permisos de:
 *   - Checkout Sessions: Write (Escritura)
 *   - Products: Write (Escritura) / Prices: Write (Escritura)
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const stripeSecretKey = getStripeKey();

  // Diagnóstico rápido si abres /.netlify/functions/create-checkout-session en el navegador
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        function: 'create-checkout-session',
        keyConfigured: Boolean(stripeSecretKey),
        keyType: stripeSecretKey ? `${stripeSecretKey.slice(0, 8)}...` : 'MISSING (Configure STRIPE_SECRET_KEY in Netlify and Trigger Deploy)'
      })
    };
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

    const originHeader = event.headers?.origin || event.headers?.Origin;
    const siteUrl = originHeader || process.env.URL || 'http://localhost:3000';

    // Si aún no se ha configurado STRIPE_SECRET_KEY en Netlify (o no se ha hecho Redeploy tras añadirla)
    if (!stripeSecretKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'demo_simulation',
          reason: 'missing_stripe_secret_key',
          message: 'Netlify aún no detecta STRIPE_SECRET_KEY. Asegúrate de llamarla STRIPE_SECRET_KEY en Environment Variables y pulsar "Trigger deploy -> Deploy site" en Netlify.',
          productId,
          checkoutUrl: `${siteUrl}/?purchase_success=true&product=${encodeURIComponent(productId)}`
        })
      };
    }

    // Si el usuario puso por error la clave pública (pk_live_) en lugar de la secreta (sk_live_ o rk_live_)
    if (stripeSecretKey.startsWith('pk_')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Has puesto la Clave Publicable (pk_live_...). Debes poner la Clave Secreta (sk_live_...) o una Clave Restringida (rk_live_...) con permisos de escritura en Checkout Sessions.'
        })
      };
    }

    // Llamada directa a la API REST de Stripe Checkout
    const params = new URLSearchParams();
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
      const rawMsg = session.error?.message || 'Error al crear sesión de Stripe';
      const isRestrictedPermissionError =
        stripeSecretKey.startsWith('rk_') &&
        (response.status === 403 || rawMsg.toLowerCase().includes('permission'));

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: isRestrictedPermissionError
            ? `Tu clave restringida (${stripeSecretKey.slice(0, 8)}...) no tiene permisos suficientes en Stripe. En Stripe > Developers > API Keys, edita tu clave rk_live y activa "Write" (Escritura) en: "Checkout Sessions", "Products" y "Prices" (o usa directamente la clave secreta estándar sk_live_...). Detalle Stripe: ${rawMsg}`
            : rawMsg
        })
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
