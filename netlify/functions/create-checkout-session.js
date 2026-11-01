/**
 * Netlify Serverless Function: create-checkout-session.js
 * Ubicación automática para Netlify: /netlify/functions/create-checkout-session.js
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

function buildCheckoutParams(product, productId, playerId, customerEmail, siteUrl, options = {}) {
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

  if (options.useTaxCode) {
    // Código fiscal oficial de Stripe para Videojuegos y bienes digitales in-game (compatible con Managed Payments)
    params.append('line_items[0][price_data][product_data][tax_code]', 'txcd_10201000');
  }
  if (options.disableManagedPayments) {
    params.append('managed_payments[enabled]', 'false');
  }

  return params;
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
    const { productId, playerId, customerEmail } = JSON.parse(event.body || '{}');
    const product = CATALOG_PRODUCTS[productId];

    if (!product) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Producto no válido en el catálogo' })
      };
    }

    const stripeSecretKey = getStripeKey();
    const originHeader = event.headers?.origin || event.headers?.Origin;
    const siteUrl = originHeader || process.env.URL || 'http://localhost:3000';

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

    // Intento 1: Con tax_code digital oficial de videojuegos (txcd_10201000) para cuentas con Managed Payments activo
    let params = buildCheckoutParams(product, productId, playerId, customerEmail, siteUrl, {
      useTaxCode: true,
      disableManagedPayments: false
    });

    let response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    let session = await response.json();

    // Intento 2 automático: Si la cuenta requiere desactivar managed_payments en la sesión, reintenta al instante
    if (!response.ok) {
      params = buildCheckoutParams(product, productId, playerId, customerEmail, siteUrl, {
        useTaxCode: false,
        disableManagedPayments: true
      });

      response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      session = await response.json();
    }

    // Intento 3 automático: Sesión estándar limpia por si la cuenta no tiene Managed Payments ni Stripe Tax
    if (!response.ok) {
      params = buildCheckoutParams(product, productId, playerId, customerEmail, siteUrl, {
        useTaxCode: false,
        disableManagedPayments: false
      });

      response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      session = await response.json();
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'No se pudo iniciar la pasarela de pago en este momento.' })
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
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
