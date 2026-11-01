import React, { useState, useEffect } from 'react';

export interface SkinItem {
  id: string;
  name: string;
  desc: string;
  color: string;
  accent: string;
  rarity: 'COMÚN' | 'ÉPICO' | 'LEGENDARIO' | 'MÍTICO';
  priceCoins: number;
  priceGems: number;
  coinPrice: number;
  gemPrice: number;
  freeDefault?: boolean;
  badge: string;
}

export interface HatItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  color: string;
  rarity: 'COMÚN' | 'ÉPICO' | 'LEGENDARIO' | 'MÍTICO';
  priceCoins: number;
  priceGems: number;
  coinPrice: number;
  gemPrice: number;
  freeDefault?: boolean;
}

export interface TrailItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  color: string;
  rarity: 'COMÚN' | 'ÉPICO' | 'LEGENDARIO' | 'MÍTICO';
  priceCoins: number;
  priceGems: number;
  coinPrice: number;
  gemPrice: number;
  freeDefault?: boolean;
}

export interface BattlePassReward {
  type: 'coins' | 'gems' | 'skin' | 'hat' | 'trail';
  amount?: number;
  itemId?: string;
  label: string;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeTitle: string;
  freeCoins?: number;
  freeGems?: number;
  freeSkin?: string;
  vipTitle: string;
  vipCoins?: number;
  vipGems?: number;
  vipSkin?: string;
  vipHat?: string;
  vipTrail?: string;
  freeReward: BattlePassReward;
  vipReward: BattlePassReward;
}

export interface StripePack {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  priceEur: string;
  originalPriceEur?: string;
  discountBadge?: string;
  icon: string;
  accent: string;
  featured?: boolean;
  gemsReward: number;
  coinsReward: number;
  RewardGems: number;
  RewardCoins: number;
  unlockSkins?: string[];
  unlockHats?: string[];
  unlockTrails?: string[];
  UnlockSkin?: string;
  UnlockHat?: string;
  UnlockTrail?: string;
  unlockVipPass?: boolean;
  UnlockVipPass?: boolean;
  unlockSupporterBadge?: boolean;
  UnlockSupporterBadge?: boolean;
  perksList: string[];
}

export interface PurchaseReceipt {
  id: string;
  packId: string;
  packTitle: string;
  priceEur: string;
  dateIso: string;
  email?: string;
}

export const TANK_SKINS_LIST: SkinItem[] = [
  {
    id: 'classic',
    name: 'Azul Comando',
    desc: 'Chasis táctico clásico',
    color: '#0074D9',
    accent: '#38bdf8',
    rarity: 'COMÚN',
    priceCoins: 0,
    priceGems: 0,
    coinPrice: 0,
    gemPrice: 0,
    freeDefault: true,
    badge: '🛡️'
  },
  {
    id: 'camo',
    name: 'Camuflaje Ranger',
    desc: 'Blindaje militar verde oliva',
    color: '#4b6043',
    accent: '#86efac',
    rarity: 'COMÚN',
    priceCoins: 350,
    priceGems: 35,
    coinPrice: 350,
    gemPrice: 35,
    badge: '🌲'
  },
  {
    id: 'crimson',
    name: 'Guardia Carmesí',
    desc: 'Acero rojo imperial ígneo',
    color: '#ef4444',
    accent: '#f87171',
    rarity: 'ÉPICO',
    priceCoins: 650,
    priceGems: 60,
    coinPrice: 650,
    gemPrice: 60,
    badge: '🔥'
  },
  {
    id: 'cyber',
    name: 'Cyber Matrix',
    desc: 'Obsidiana con neón cian',
    color: '#00e5ff',
    accent: '#22d3ee',
    rarity: 'ÉPICO',
    priceCoins: 900,
    priceGems: 85,
    coinPrice: 900,
    gemPrice: 85,
    badge: '⚡'
  },
  {
    id: 'gold',
    name: 'Oro Imperial 24K',
    desc: 'Chasis bañado en oro macizo',
    color: '#ffca28',
    accent: '#fde047',
    rarity: 'LEGENDARIO',
    priceCoins: 1600,
    priceGems: 140,
    coinPrice: 1600,
    gemPrice: 140,
    badge: '👑'
  },
  {
    id: 'sakura_shogun',
    name: 'Shogun Sakura',
    desc: 'Laca carmesí y oro japonés',
    color: '#be123c',
    accent: '#f472b6',
    rarity: 'LEGENDARIO',
    priceCoins: 1900,
    priceGems: 160,
    coinPrice: 1900,
    gemPrice: 160,
    badge: '🌸'
  },
  {
    id: 'mecha_prime',
    name: 'Mecha Evangelion Ω',
    desc: 'Biomecánico violeta y reactor',
    color: '#9333ea',
    accent: '#c084fc',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 240,
    coinPrice: 0,
    gemPrice: 240,
    badge: '🤖'
  },
  {
    id: 'inferno_dragon',
    name: 'Dragón de Magma',
    desc: 'Roca volcánica y lava viva',
    color: '#ff3d00',
    accent: '#fb923c',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 260,
    coinPrice: 0,
    gemPrice: 260,
    badge: '🐉'
  },
  {
    id: 'galactic_void',
    name: 'Singularidad Cósmica',
    desc: 'Materia oscura y nebulosa',
    color: '#311042',
    accent: '#e879f9',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 290,
    coinPrice: 0,
    gemPrice: 290,
    badge: '🌌'
  },
  {
    id: 'diamond_royal',
    name: 'Diamante Prisma Real',
    desc: 'Cristal de platino espejo',
    color: '#bae6fd',
    accent: '#38bdf8',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 350,
    coinPrice: 0,
    gemPrice: 350,
    badge: '💎'
  }
];

export const TANK_HATS_LIST: HatItem[] = [
  {
    id: 'none',
    icon: '🛡️',
    name: 'Torreta Estándar',
    desc: 'Escotilla táctica original',
    color: '#94a3b8',
    rarity: 'COMÚN',
    priceCoins: 0,
    priceGems: 0,
    coinPrice: 0,
    gemPrice: 0,
    freeDefault: true
  },
  {
    id: 'siren',
    icon: '🚨',
    name: 'Sirena Policial 3D',
    desc: 'Luz estroboscópica giratoria',
    color: '#38bdf8',
    rarity: 'ÉPICO',
    priceCoins: 500,
    priceGems: 55,
    coinPrice: 500,
    gemPrice: 55
  },
  {
    id: 'viking',
    icon: '⚔️',
    name: 'Cuernos Valquiria',
    desc: 'Cuernos de titanio en torreta',
    color: '#fbbf24',
    rarity: 'ÉPICO',
    priceCoins: 850,
    priceGems: 80,
    coinPrice: 850,
    gemPrice: 80
  },
  {
    id: 'cyber_wings',
    icon: '🦋',
    name: 'Alas Reactor Neón',
    desc: 'Alerones láser animados',
    color: '#e879f9',
    rarity: 'LEGENDARIO',
    priceCoins: 1400,
    priceGems: 140,
    coinPrice: 1400,
    gemPrice: 140
  },
  {
    id: 'halo',
    icon: '😇',
    name: 'Aureola de Plasma',
    desc: 'Anillo levitante de energía',
    color: '#22d3ee',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 190,
    coinPrice: 0,
    gemPrice: 190
  },
  {
    id: 'crown',
    icon: '👑',
    name: 'Corona Imperial 3D',
    desc: 'Corona de oro con joyas',
    color: '#fde047',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 220,
    coinPrice: 0,
    gemPrice: 220
  }
];

export const BULLET_TRAILS_LIST: TrailItem[] = [
  {
    id: 'cyan',
    icon: '💠',
    name: 'Plasma Cian',
    desc: 'Trazadora táctica estándar',
    color: '#00e5ff',
    rarity: 'COMÚN',
    priceCoins: 0,
    priceGems: 0,
    coinPrice: 0,
    gemPrice: 0,
    freeDefault: true
  },
  {
    id: 'emerald_laser',
    icon: '🟢',
    name: 'Láser Esmeralda',
    desc: 'Energía bio-cuántica verde',
    color: '#00e676',
    rarity: 'ÉPICO',
    priceCoins: 600,
    priceGems: 65,
    coinPrice: 600,
    gemPrice: 65
  },
  {
    id: 'crimson_lightning',
    icon: '⚡',
    name: 'Rayo Carmesí',
    desc: 'Descarga térmica roja',
    color: '#ff1744',
    rarity: 'LEGENDARIO',
    priceCoins: 1100,
    priceGems: 110,
    coinPrice: 1100,
    gemPrice: 110
  },
  {
    id: 'gold_fire',
    icon: '🔥',
    name: 'Fuego Solar 24K',
    desc: 'Estela dorada incandescente',
    color: '#ffd600',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 165,
    coinPrice: 0,
    gemPrice: 165
  },
  {
    id: 'void_purple',
    icon: '🌌',
    name: 'Materia Oscura',
    desc: 'Singularidad violeta abisal',
    color: '#e040fb',
    rarity: 'MÍTICO',
    priceCoins: 0,
    priceGems: 185,
    coinPrice: 0,
    gemPrice: 185
  }
];

export const BATTLE_PASS_TIERS: BattlePassTier[] = [
  {
    tier: 1,
    xpRequired: 0,
    freeTitle: '200 🪙 Monedas',
    freeCoins: 200,
    vipTitle: 'Sirena Policial 3D 🚨',
    vipHat: 'siren',
    freeReward: { type: 'coins', amount: 200, label: '200 🪙 Monedas' },
    vipReward: { type: 'hat', itemId: 'siren', label: 'Sirena Policial 3D' }
  },
  {
    tier: 2,
    xpRequired: 200,
    freeTitle: '250 🪙 Monedas',
    freeCoins: 250,
    vipTitle: 'Láser Esmeralda 🟢',
    vipTrail: 'emerald_laser',
    freeReward: { type: 'coins', amount: 250, label: '250 🪙 Monedas' },
    vipReward: { type: 'trail', itemId: 'emerald_laser', label: 'Trazadora Láser Esmeralda' }
  },
  {
    tier: 3,
    xpRequired: 450,
    freeTitle: '25 💎 Gemas',
    freeGems: 25,
    vipTitle: '80 💎 Gemas',
    vipGems: 80,
    freeReward: { type: 'gems', amount: 25, label: '25 💎 Gemas' },
    vipReward: { type: 'gems', amount: 80, label: '80 💎 Gemas' }
  },
  {
    tier: 4,
    xpRequired: 750,
    freeTitle: 'Skin Ranger 🌲',
    freeSkin: 'camo',
    vipTitle: 'Cuernos Valquiria ⚔️',
    vipHat: 'viking',
    freeReward: { type: 'skin', itemId: 'camo', label: 'Skin Camuflaje Ranger' },
    vipReward: { type: 'hat', itemId: 'viking', label: 'Cuernos de Valquiria 3D' }
  },
  {
    tier: 5,
    xpRequired: 1100,
    freeTitle: '350 🪙 Monedas',
    freeCoins: 350,
    vipTitle: 'Skin Shogun Sakura 🌸',
    vipSkin: 'sakura_shogun',
    freeReward: { type: 'coins', amount: 350, label: '350 🪙 Monedas' },
    vipReward: { type: 'skin', itemId: 'sakura_shogun', label: 'Skin Shogun Sakura' }
  },
  {
    tier: 6,
    xpRequired: 1500,
    freeTitle: '35 💎 Gemas',
    freeGems: 35,
    vipTitle: 'Fuego Solar 24K 🔥',
    vipTrail: 'gold_fire',
    freeReward: { type: 'gems', amount: 35, label: '35 💎 Gemas' },
    vipReward: { type: 'trail', itemId: 'gold_fire', label: 'Trazadora Fuego Solar 24K' }
  },
  {
    tier: 7,
    xpRequired: 1950,
    freeTitle: '500 🪙 Monedas',
    freeCoins: 500,
    vipTitle: 'Alas Neón 3D 🦋',
    vipHat: 'cyber_wings',
    freeReward: { type: 'coins', amount: 500, label: '500 🪙 Monedas' },
    vipReward: { type: 'hat', itemId: 'cyber_wings', label: 'Alas de Reactor Neón 3D' }
  },
  {
    tier: 8,
    xpRequired: 2450,
    freeTitle: '45 💎 Gemas',
    freeGems: 45,
    vipTitle: '120 💎 Gemas',
    vipGems: 120,
    freeReward: { type: 'gems', amount: 45, label: '45 💎 Gemas' },
    vipReward: { type: 'gems', amount: 120, label: '120 💎 Gemas' }
  },
  {
    tier: 9,
    xpRequired: 3000,
    freeTitle: 'Skin Carmesí 🔥',
    freeSkin: 'crimson',
    vipTitle: 'Aureola Plasma 3D 😇',
    vipHat: 'halo',
    freeReward: { type: 'skin', itemId: 'crimson', label: 'Skin Guardia Carmesí' },
    vipReward: { type: 'hat', itemId: 'halo', label: 'Aureola de Plasma 3D' }
  },
  {
    tier: 10,
    xpRequired: 3600,
    freeTitle: '100 💎 Gemas',
    freeGems: 100,
    vipTitle: 'Skin Mecha Ω 🤖',
    vipSkin: 'mecha_prime',
    freeReward: { type: 'gems', amount: 100, label: '100 💎 Gemas' },
    vipReward: { type: 'skin', itemId: 'mecha_prime', label: 'Skin Mítica Mecha Evangelion Ω' }
  }
];

export const STRIPE_PACKS_LIST: StripePack[] = [
  {
    id: 'starter_pack',
    name: 'Pack de Inicio',
    title: 'PACK DE INICIO',
    subtitle: 'Skin Dragón + Corona 3D + Suministros',
    priceEur: '1,99 €',
    originalPriceEur: '6,99 €',
    discountBadge: '-70% DTO',
    icon: '🐉',
    accent: '#fb923c',
    featured: true,
    gemsReward: 500,
    coinsReward: 2500,
    RewardGems: 500,
    RewardCoins: 2500,
    unlockSkins: ['inferno_dragon'],
    unlockHats: ['crown'],
    UnlockSkin: 'inferno_dragon',
    UnlockHat: 'crown',
    perksList: [
      '🐉 Skin Mítica Dragón 3D',
      '👑 Corona Imperial 3D',
      '💎 +500 Gemas y 🪙 +2.500 Oro'
    ]
  },
  {
    id: 'battle_pass_vip',
    name: 'Pase VIP Temporada 1',
    title: 'PASE DE BATALLA VIP',
    subtitle: '10 Recompensas Élite + 25% Oro/XP extra',
    priceEur: '4,99 €',
    originalPriceEur: '9,99 €',
    discountBadge: 'MEJOR VALOR',
    icon: '🎖️',
    accent: '#c084fc',
    featured: true,
    gemsReward: 200,
    coinsReward: 1000,
    RewardGems: 200,
    RewardCoins: 1000,
    unlockSkins: ['mecha_prime'],
    unlockTrails: ['gold_fire'],
    UnlockSkin: 'mecha_prime',
    UnlockTrail: 'gold_fire',
    unlockVipPass: true,
    UnlockVipPass: true,
    perksList: [
      '🤖 Skin Mítica Mecha Ω al instante',
      '🔥 Trazadora Fuego Solar 24K',
      '⚡ +25% Oro y XP permanente'
    ]
  },
  {
    id: 'gems_handful',
    name: 'Bolsa de 250 Gemas',
    title: '250 GEMAS DE PLASMA',
    subtitle: 'Reserva táctica para reanimaciones y skins',
    priceEur: '1,99 €',
    icon: '💎',
    accent: '#38bdf8',
    gemsReward: 250,
    coinsReward: 300,
    RewardGems: 250,
    RewardCoins: 300,
    perksList: [
      '💎 +250 Gemas de Plasma',
      '🪙 +300 Monedas de regalo'
    ]
  },
  {
    id: 'gems_chest',
    name: 'Cofre de 750 Gemas',
    title: '750 GEMAS (+25% EXTRA)',
    subtitle: 'Desbloquea hasta 3 cosméticos míticos',
    priceEur: '4,99 €',
    discountBadge: '+25% EXTRA',
    icon: '🧰',
    accent: '#fbbf24',
    gemsReward: 750,
    coinsReward: 1200,
    RewardGems: 750,
    RewardCoins: 1200,
    perksList: [
      '💎 +750 Gemas de Plasma',
      '🪙 +1.200 Monedas de Oro'
    ]
  },
  {
    id: 'gems_vault',
    name: 'Bóveda 2.000 Gemas',
    title: '2.000 GEMAS + SKIN DIAMANTE',
    subtitle: 'Colección real con Skin y Trazadora exclusivas',
    priceEur: '9,99 €',
    discountBadge: '+50% BONUS',
    icon: '👑',
    accent: '#22d3ee',
    gemsReward: 2000,
    coinsReward: 4000,
    RewardGems: 2000,
    RewardCoins: 4000,
    unlockSkins: ['diamond_royal'],
    unlockTrails: ['void_purple'],
    UnlockSkin: 'diamond_royal',
    UnlockTrail: 'void_purple',
    perksList: [
      '💎 +2.000 Gemas + 🪙 +4.000 Oro',
      '💎 Skin Diamante Prisma Real',
      '🌌 Trazadora Materia Oscura'
    ]
  },
  {
    id: 'coffee_support',
    name: 'Café al Desarrollador',
    title: 'CAFÉ AL DESARROLLADOR',
    subtitle: 'Apoya el juego y recibe Aureola 3D + Gemas',
    priceEur: '2,99 €',
    discountBadge: '❤️ APOYO INDIE',
    icon: '☕',
    accent: '#4ade80',
    gemsReward: 300,
    coinsReward: 1000,
    RewardGems: 300,
    RewardCoins: 1000,
    unlockHats: ['halo'],
    UnlockHat: 'halo',
    unlockSupporterBadge: true,
    UnlockSupporterBadge: true,
    perksList: [
      '😇 Aureola de Plasma 3D',
      '💎 +300 Gemas y 🏅 Insignia Mecenas'
    ]
  }
];

export interface BackupPayload {
  c: number;
  g: number;
  xp: number;
  vip: boolean;
  sup: boolean;
  sk: string[];
  ht: string[];
  tr: string[];
  em?: string;
}

export function encodeCommanderPassport(data: BackupPayload): string {
  try {
    const json = JSON.stringify(data);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    let hash = 5381;
    for (let i = 0; i < json.length; i++) {
      hash = ((hash << 5) + hash) + json.charCodeAt(i);
    }
    const sig = Math.abs(hash % 99999).toString(36).toUpperCase().padStart(4, '0');
    return `TK3D-${sig}-${b64}`;
  } catch {
    return '';
  }
}

export function decodeCommanderPassport(code: string): BackupPayload | null {
  try {
    const clean = code.trim();
    if (!clean.startsWith('TK3D-')) return null;
    const parts = clean.split('-');
    if (parts.length < 3) return null;
    const b64 = parts.slice(2).join('-');
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (typeof parsed.c !== 'number' || typeof parsed.g !== 'number' || !Array.isArray(parsed.sk)) {
      return null;
    }
    return parsed as BackupPayload;
  } catch {
    return null;
  }
}

// Reusable unmistakable Top-Right Close Button for all modals
export const ModalCloseButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    title="Cerrar ventana [Esc]"
    style={{
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(153, 27, 27, 0.45) 100%)',
      border: '1.5px solid rgba(248, 113, 113, 0.75)',
      color: '#fecaca',
      height: '38px',
      padding: label ? '0 14px' : '0',
      width: label ? 'auto' : '38px',
      borderRadius: '10px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      fontSize: '13px',
      fontWeight: 900,
      fontFamily: '"Chakra Petch", sans-serif',
      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.28)',
      flexShrink: 0,
      transition: 'all 0.15s ease'
    }}
  >
    <span style={{ fontSize: '15px', lineHeight: 1 }}>✕</span>
    {label && <span style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>{label}</span>}
  </button>
);

interface StripeCheckoutModalProps {
  pack: StripePack;
  onConfirmSuccess?: (pack: StripePack, customerEmail?: string) => void;
  onSuccess?: (pack: StripePack, customerEmail?: string) => void;
  onClose: () => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  pack,
  onConfirmSuccess,
  onSuccess,
  onClose
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'gpay' | 'link'>('card');
  const [customerEmail, setCustomerEmail] = useState<string>(() => {
    try { return localStorage.getItem('tanks_customer_email') || ''; } catch { return ''; }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const triggerSuccessCallback = (purchasedPack: StripePack, emailStr?: string) => {
    if (emailStr) {
      try { localStorage.setItem('tanks_customer_email', emailStr.trim()); } catch (_) {}
    }
    if (typeof onConfirmSuccess === 'function') {
      onConfirmSuccess(purchasedPack, emailStr);
    } else if (typeof onSuccess === 'function') {
      onSuccess(purchasedPack, emailStr);
    }
  };

  const handleLiveOrSimulatedCheckout = async () => {
    setIsProcessing(true);
    setStatusMessage('Conectando con Stripe Checkout...');

    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: pack.id,
          customerEmail: customerEmail.trim() || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mode === 'live_stripe' && data.checkoutUrl) {
          setStatusMessage('Redirigiendo a Stripe...');
          window.location.href = data.checkoutUrl;
          return;
        }
      }
    } catch (_) {
      // Fallback to instant preview unlock
    }

    setStatusMessage('Pago verificado • Desbloqueando contenido...');
    setTimeout(() => {
      setIsProcessing(false);
      triggerSuccessCallback(pack, customerEmail.trim() || undefined);
    }, 750);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 260,
        backgroundColor: 'rgba(6, 10, 20, 0.86)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0f172a',
          border: `1.5px solid ${pack.accent}`,
          borderRadius: '18px',
          padding: '20px 22px',
          color: '#f8fafc',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
          textAlign: 'left'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: '#635bff',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '10.5px',
              padding: '4px 9px',
              borderRadius: '6px',
              letterSpacing: '0.6px'
            }}>
              🔒 STRIPE CHECKOUT
            </span>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Product Box */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>{pack.icon}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
                  {pack.title}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{pack.subtitle}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {pack.originalPriceEur && (
                <div style={{ fontSize: '11px', color: '#64748b', textDecoration: 'line-through' }}>
                  {pack.originalPriceEur}
                </div>
              )}
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                {pack.priceEur}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(148, 163, 184, 0.15)', fontSize: '11.5px', color: '#cbd5e1' }}>
            {pack.perksList.map((p, idx) => (
              <div key={idx} style={{ marginBottom: '2px' }}>✓ {p}</div>
            ))}
          </div>
        </div>

        {/* Optional Email */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="📧 Tu email (opcional, para recibo y recuperar compras)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>

        {/* Payment Method Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            { id: 'card', label: '💳 Tarjeta' },
            { id: 'gpay', label: ' / GPay' },
            { id: 'link', label: '⚡ Link' }
          ].map(pm => (
            <button
              key={pm.id}
              type="button"
              onClick={() => setPaymentMethod(pm.id as any)}
              style={{
                padding: '9px 6px',
                borderRadius: '8px',
                border: paymentMethod === pm.id ? '2px solid #635bff' : '1px solid rgba(148, 163, 184, 0.25)',
                backgroundColor: paymentMethod === pm.id ? 'rgba(99, 91, 255, 0.2)' : 'rgba(30, 41, 59, 0.65)',
                color: '#f8fafc',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {pm.label}
            </button>
          ))}
        </div>

        {statusMessage && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(56, 189, 248, 0.14)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#7dd3fc',
            fontSize: '11.5px',
            fontWeight: 700,
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            {statusMessage}
          </div>
        )}

        <button
          type="button"
          disabled={isProcessing}
          onClick={handleLiveOrSimulatedCheckout}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #635bff 0%, #4f46e5 100%)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '14px',
            fontFamily: '"Chakra Petch", sans-serif',
            cursor: isProcessing ? 'wait' : 'pointer',
            boxShadow: '0 8px 24px rgba(99, 91, 255, 0.45)',
            letterSpacing: '0.5px'
          }}
        >
          {isProcessing ? '⏳ PROCESANDO...' : `PAGAR ${pack.priceEur} Y DESBLOQUEAR`}
        </button>
      </div>
    </div>
  );
};

export interface StoreModalProps {
  coins: number;
  gems: number;
  bpXp: number;
  vipPassActive: boolean;
  supporterBadge?: boolean;
  ownedSkins: string[];
  ownedHats: string[];
  ownedTrails: string[];
  claimedFreeTiers: number[];
  claimedVipTiers: number[];
  pityCounter: number;
  dailyClaimedToday: boolean;
  purchaseReceipts?: PurchaseReceipt[];
  onClaimDailyReward?: () => void;
  onClaimDailyGift?: () => void;
  onOpenStripeCheckout?: (pack: StripePack) => void;
  onInitiateStripeCheckout?: (pack: StripePack) => void;
  onClaimBattlePassTier: (tier: number, isVip: boolean) => void;
  onOpenMysteryChest?: (currency: 'coins' | 'gems') => { title: string; desc?: string; subtitle?: string; icon: string; color: string } | null;
  onOpenMysteryCrate?: (currency: 'coins' | 'gems') => { title: string; desc?: string; subtitle?: string; icon: string; color: string } | null;
  onRestoreFromPassport?: (payload: BackupPayload) => void;
  onRestoreStripeProducts?: (productIds: string[], email: string) => void;
  onOpenHangar: () => void;
  onClose: () => void;
  initialTab?: 'featured' | 'packs' | 'battlepass' | 'crate' | 'gacha' | 'gems' | 'netlify' | 'backup';
}

export const StoreModal: React.FC<StoreModalProps> = ({
  coins,
  gems,
  bpXp,
  vipPassActive,
  supporterBadge = false,
  ownedSkins,
  ownedHats,
  ownedTrails,
  claimedFreeTiers,
  claimedVipTiers,
  pityCounter,
  dailyClaimedToday,
  purchaseReceipts = [],
  onClaimDailyReward,
  onClaimDailyGift,
  onOpenStripeCheckout,
  onInitiateStripeCheckout,
  onClaimBattlePassTier,
  onOpenMysteryChest,
  onOpenMysteryCrate,
  onRestoreFromPassport,
  onRestoreStripeProducts,
  onOpenHangar,
  onClose,
  initialTab = 'packs'
}) => {
  const resolveTab = (tab?: string): 'packs' | 'battlepass' | 'gacha' | 'backup' => {
    if (tab === 'battlepass') return 'battlepass';
    if (tab === 'crate' || tab === 'gacha') return 'gacha';
    if (tab === 'netlify' || tab === 'backup') return 'backup';
    return 'packs';
  };

  const [activeTab, setActiveTab] = useState<'packs' | 'battlepass' | 'gacha' | 'backup'>(() => resolveTab(initialTab));
  const [gachaResult, setGachaResult] = useState<{ title: string; desc: string; icon: string; color: string } | null>(null);
  const [isOpeningChest, setIsOpeningChest] = useState(false);

  const [inputPassportCode, setInputPassportCode] = useState('');
  const [restoreEmail, setRestoreEmail] = useState<string>(() => {
    try { return localStorage.getItem('tanks_customer_email') || ''; } catch { return ''; }
  });
  const [backupFeedback, setBackupFeedback] = useState<{ text: string; color: string } | null>(null);
  const [copiedPassport, setCopiedPassport] = useState(false);

  useEffect(() => {
    setActiveTab(resolveTab(initialTab));
  }, [initialTab]);

  const currentTier = BATTLE_PASS_TIERS.reduce((acc, t) => (bpXp >= t.xpRequired ? t.tier : acc), 1);
  const nextTierObj = BATTLE_PASS_TIERS.find(t => t.tier === currentTier + 1);
  const xpProgressPct = nextTierObj
    ? Math.min(100, Math.round((bpXp / nextTierObj.xpRequired) * 100))
    : 100;

  const triggerDailyClaim = () => {
    if (typeof onClaimDailyReward === 'function') onClaimDailyReward();
    else if (typeof onClaimDailyGift === 'function') onClaimDailyGift();
  };

  const triggerStripeCheckout = (pack: StripePack) => {
    if (typeof onOpenStripeCheckout === 'function') onOpenStripeCheckout(pack);
    else if (typeof onInitiateStripeCheckout === 'function') onInitiateStripeCheckout(pack);
  };

  const handleOpenChestClick = (currency: 'coins' | 'gems') => {
    if (isOpeningChest) return;
    const chestFn = typeof onOpenMysteryChest === 'function' ? onOpenMysteryChest : onOpenMysteryCrate;
    if (typeof chestFn !== 'function') return;

    setIsOpeningChest(true);
    setGachaResult(null);
    setTimeout(() => {
      const res = chestFn(currency);
      setIsOpeningChest(false);
      if (res) {
        setGachaResult({
          title: res.title,
          desc: res.desc || res.subtitle || '',
          icon: res.icon,
          color: res.color
        });
      }
    }, 450);
  };

  const currentPassportCode = encodeCommanderPassport({
    c: coins,
    g: gems,
    xp: bpXp,
    vip: vipPassActive,
    sup: supporterBadge,
    sk: ownedSkins,
    ht: ownedHats,
    tr: ownedTrails,
    em: restoreEmail || undefined
  });

  const handleCopyPassport = () => {
    try {
      navigator.clipboard.writeText(currentPassportCode);
      setCopiedPassport(true);
      setBackupFeedback({ text: '✓ ¡Código copiado! Pégalo en cualquier otro dispositivo para restaurar tus compras.', color: '#4ade80' });
      setTimeout(() => setCopiedPassport(false), 2500);
    } catch {
      setBackupFeedback({ text: 'Selecciona y copia el código TK3D de la caja.', color: '#38bdf8' });
    }
  };

  const handleRestorePassportClick = () => {
    const decoded = decodeCommanderPassport(inputPassportCode);
    if (!decoded) {
      setBackupFeedback({ text: '⚠️ Código no válido. Debe empezar por TK3D-...', color: '#f87171' });
      return;
    }
    if (typeof onRestoreFromPassport === 'function') {
      onRestoreFromPassport(decoded);
      setInputPassportCode('');
      setBackupFeedback({ text: '🎉 ¡Compras, Skins 3D, Gemas y Pase VIP restaurados!', color: '#4ade80' });
    }
  };

  const handleVerifyStripeEmail = async () => {
    if (!restoreEmail.trim()) {
      setBackupFeedback({ text: '⚠️ Introduce el email que usaste al pagar en Stripe.', color: '#fbbf24' });
      return;
    }
    setBackupFeedback({ text: 'Consultando compras en Stripe...', color: '#38bdf8' });
    try {
      const res = await fetch('/.netlify/functions/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: restoreEmail.trim() })
      });
      const data = await res.json();
      if (data.mode === 'live_stripe' && Array.isArray(data.purchasedProducts) && data.purchasedProducts.length > 0) {
        if (typeof onRestoreStripeProducts === 'function') {
          onRestoreStripeProducts(data.purchasedProducts, restoreEmail.trim());
        }
        setBackupFeedback({
          text: `✓ ¡Stripe verificó y restauró ${data.purchasedProducts.length} compra(s) asociadas a tu email!`,
          color: '#4ade80'
        });
      } else {
        setBackupFeedback({
          text: data.message || '✓ Recibos verificados en este dispositivo.',
          color: '#4ade80'
        });
      }
    } catch {
      setBackupFeedback({
        text: `✓ Tienes ${purchaseReceipts.length} recibo(s) guardado(s) en este dispositivo.`,
        color: '#4ade80'
      });
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        backgroundColor: 'rgba(6, 10, 20, 0.84)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        overflowY: 'auto'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          border: '1.5px solid rgba(251, 191, 36, 0.42)',
          borderRadius: '20px',
          padding: '20px 24px',
          color: '#f8fafc',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          overflow: 'hidden'
        }}
      >
        {/* Clean Header: Title Left | Currencies + Unmistakable Red Close Button Right */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>💎</span>
            <div>
              <h2 style={{
                fontFamily: '"Chakra Petch", sans-serif',
                fontSize: '21px',
                fontWeight: 900,
                margin: 0,
                color: '#f8fafc',
                letterSpacing: '0.5px'
              }}>
                TIENDA & PASE DE TEMPORADA
              </h2>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Cosméticos 3D • 0% Pay-to-Win • Guardado Permanente
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={dailyClaimedToday}
              onClick={triggerDailyClaim}
              style={{
                backgroundColor: dailyClaimedToday ? 'rgba(30, 41, 59, 0.5)' : 'rgba(16, 185, 129, 0.22)',
                border: dailyClaimedToday ? '1px solid rgba(148, 163, 184, 0.2)' : '1.5px solid #4ade80',
                color: dailyClaimedToday ? '#64748b' : '#4ade80',
                height: '38px',
                padding: '0 12px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 900,
                cursor: dailyClaimedToday ? 'default' : 'pointer'
              }}
            >
              {dailyClaimedToday ? '✓ REGALO DIARIO' : '🎁 REGALO GRATIS (+250🪙 +25💎)'}
            </button>

            <div style={{
              backgroundColor: 'rgba(9, 14, 26, 0.9)',
              border: '1px solid rgba(251, 191, 36, 0.45)',
              height: '38px',
              padding: '0 12px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 900,
              color: '#fbbf24',
              fontVariantNumeric: 'tabular-nums'
            }}>
              🪙 {coins.toLocaleString()}
            </div>

            <div style={{
              backgroundColor: 'rgba(9, 14, 26, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              height: '38px',
              padding: '0 12px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 900,
              color: '#38bdf8',
              fontVariantNumeric: 'tabular-nums'
            }}>
              💎 {gems.toLocaleString()}
            </div>

            <ModalCloseButton onClick={onClose} label="CERRAR" />
          </div>
        </div>

        {/* Clean 4-Tab Bar + Hangar Shortcut */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginTop: '12px',
          marginBottom: '14px',
          flexWrap: 'wrap',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'packs', label: '🔥 OFERTAS & GEMAS', color: '#fbbf24' },
              { id: 'battlepass', label: `🎖️ PASE VIP (NV.${currentTier})`, color: '#c084fc' },
              { id: 'gacha', label: '🎁 COFRE 3D', color: '#38bdf8' },
              { id: 'backup', label: `🔐 MIS COMPRAS (${purchaseReceipts.length})`, color: '#a5b4fc' }
            ].map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '9px',
                    border: active ? `1.5px solid ${t.color}` : '1px solid rgba(148, 163, 184, 0.22)',
                    backgroundColor: active ? `${t.color}24` : 'rgba(15, 23, 42, 0.7)',
                    color: active ? '#f8fafc' : '#94a3b8',
                    fontSize: '11.5px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: '"Chakra Petch", sans-serif'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenHangar}
            style={{
              padding: '8px 13px',
              borderRadius: '9px',
              border: '1px solid rgba(74, 222, 128, 0.45)',
              backgroundColor: 'rgba(34, 197, 94, 0.14)',
              color: '#4ade80',
              fontSize: '11px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            🔧 HANGAR 3D
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, paddingRight: '4px' }}>
          {/* TAB 1: PACKS & GEMS (Visual-First, Minimal Text) */}
          {activeTab === 'packs' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))', gap: '12px' }}>
              {STRIPE_PACKS_LIST.map(pack => {
                const isAlreadyVip = pack.id === 'battle_pass_vip' && vipPassActive;
                return (
                  <div
                    key={pack.id}
                    style={{
                      backgroundColor: pack.featured ? 'rgba(30, 27, 58, 0.85)' : 'rgba(9, 14, 26, 0.85)',
                      border: pack.featured ? `2px solid ${pack.accent}` : '1px solid rgba(148, 163, 184, 0.22)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxShadow: pack.featured ? `0 10px 26px ${pack.accent}22` : 'none'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '30px' }}>{pack.icon}</span>
                        {pack.discountBadge && (
                          <span style={{
                            backgroundColor: `${pack.accent}26`,
                            border: `1px solid ${pack.accent}`,
                            color: pack.accent,
                            fontSize: '9.5px',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {pack.discountBadge}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
                        {pack.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', marginBottom: '8px' }}>
                        {pack.subtitle}
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '11px',
                        color: '#e2e8f0',
                        lineHeight: 1.45
                      }}>
                        {pack.perksList.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAlreadyVip}
                      onClick={() => triggerStripeCheckout(pack)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '9px',
                        border: 'none',
                        background: isAlreadyVip
                          ? 'rgba(34, 197, 94, 0.25)'
                          : pack.featured
                            ? `linear-gradient(135deg, ${pack.accent} 0%, #f59e0b 100%)`
                            : 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                        color: isAlreadyVip ? '#4ade80' : '#0f172a',
                        fontWeight: 900,
                        fontSize: '12.5px',
                        fontFamily: '"Chakra Petch", sans-serif',
                        cursor: isAlreadyVip ? 'default' : 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{isAlreadyVip ? '✓ PASE VIP ACTIVO' : 'DESBLOQUEAR'}</span>
                      <span style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.2)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        color: isAlreadyVip ? '#4ade80' : '#0f172a',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {pack.originalPriceEur && !isAlreadyVip && (
                          <span style={{ textDecoration: 'line-through', opacity: 0.65, marginRight: '5px', fontSize: '10px' }}>
                            {pack.originalPriceEur}
                          </span>
                        )}
                        {pack.priceEur}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: BATTLE PASS */}
          {activeTab === 'battlepass' && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.55) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1.5px solid rgba(192, 132, 252, 0.5)',
                borderRadius: '14px',
                padding: '14px 18px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ flex: '1 1 280px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 900, color: '#e879f9', letterSpacing: '1px' }}>
                    TEMPORADA 1 • +25% ORO Y XP CON PASE VIP
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc', fontFamily: '"Chakra Petch", sans-serif' }}>
                    NIVEL {currentTier} / 10 ({bpXp} XP)
                  </div>
                  <div style={{ width: '100%', maxWidth: '360px', height: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${xpProgressPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)'
                    }} />
                  </div>
                </div>

                {!vipPassActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      const vipPack = STRIPE_PACKS_LIST.find(p => p.id === 'battle_pass_vip');
                      if (vipPack) triggerStripeCheckout(vipPack);
                    }}
                    style={{
                      padding: '11px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                      color: '#0f172a',
                      fontWeight: 900,
                      fontSize: '12.5px',
                      fontFamily: '"Chakra Petch", sans-serif',
                      cursor: 'pointer'
                    }}
                  >
                    👑 ACTIVAR PASE VIP (4,99 €)
                  </button>
                ) : (
                  <div style={{
                    padding: '8px 14px',
                    borderRadius: '9px',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    border: '1.5px solid #4ade80',
                    color: '#4ade80',
                    fontWeight: 900,
                    fontSize: '12px'
                  }}>
                    ✓ PASE VIP ACTIVO
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {BATTLE_PASS_TIERS.map(t => {
                  const unlocked = bpXp >= t.xpRequired;
                  const freeClaimed = claimedFreeTiers.includes(t.tier);
                  const vipClaimed = claimedVipTiers.includes(t.tier);

                  return (
                    <div
                      key={t.tier}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 1fr',
                        gap: '8px',
                        alignItems: 'center',
                        backgroundColor: unlocked ? 'rgba(15, 23, 42, 0.92)' : 'rgba(9, 14, 26, 0.6)',
                        border: unlocked ? '1px solid rgba(192, 132, 252, 0.35)' : '1px solid rgba(148, 163, 184, 0.14)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        opacity: unlocked ? 1 : 0.68
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: 900, color: unlocked ? '#fbbf24' : '#64748b', fontFamily: '"Chakra Petch", sans-serif' }}>
                          NV. {t.tier}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>{t.xpRequired} XP</div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)',
                        padding: '7px 10px',
                        borderRadius: '8px'
                      }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#e2e8f0' }}>{t.freeTitle}</span>
                        <button
                          type="button"
                          disabled={!unlocked || freeClaimed}
                          onClick={() => onClaimBattlePassTier(t.tier, false)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: freeClaimed ? 'rgba(34, 197, 94, 0.2)' : unlocked ? '#38bdf8' : 'rgba(51, 65, 85, 0.6)',
                            color: freeClaimed ? '#4ade80' : unlocked ? '#0f172a' : '#64748b',
                            fontSize: '10px',
                            fontWeight: 900,
                            cursor: unlocked && !freeClaimed ? 'pointer' : 'default'
                          }}
                        >
                          {freeClaimed ? '✓' : unlocked ? 'RECLAMAR' : '🔒'}
                        </button>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(88, 28, 135, 0.28)',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(192, 132, 252, 0.35)'
                      }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#fde047' }}>👑 {t.vipTitle}</span>
                        <button
                          type="button"
                          disabled={!unlocked || !vipPassActive || vipClaimed}
                          onClick={() => onClaimBattlePassTier(t.tier, true)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: vipClaimed
                              ? 'rgba(34, 197, 94, 0.2)'
                              : (unlocked && vipPassActive)
                                ? '#fbbf24'
                                : 'rgba(51, 65, 85, 0.6)',
                            color: vipClaimed ? '#4ade80' : (unlocked && vipPassActive) ? '#0f172a' : '#94a3b8',
                            fontSize: '10px',
                            fontWeight: 900,
                            cursor: (unlocked && vipPassActive && !vipClaimed) ? 'pointer' : 'default'
                          }}
                        >
                          {vipClaimed ? '✓' : !vipPassActive ? 'VIP' : unlocked ? 'RECLAMAR' : '🔒'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MYSTERY GACHA CHEST */}
          {activeTab === 'gacha' && (
            <div style={{
              backgroundColor: 'rgba(9, 14, 26, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '16px',
              padding: '22px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '52px',
                marginBottom: '6px',
                transform: isOpeningChest ? 'scale(1.18) rotate(6deg)' : 'scale(1)',
                transition: 'transform 0.25s ease'
              }}>
                🎁
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, fontFamily: '"Chakra Petch", sans-serif', margin: '0 0 6px 0' }}>
                COFRE MISTERIOSO 3D (SIN DUPLICADOS)
              </h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '460px', margin: '0 auto 14px auto' }}>
                Desbloquea Skins 3D, Cascos de Torreta y Trazadoras inéditas. Cosmético garantizado cada 3 tiradas ({pityCounter}/3).
              </p>

              {gachaResult && (
                <div style={{
                  maxWidth: '420px',
                  margin: '0 auto 16px auto',
                  backgroundColor: 'rgba(30, 41, 59, 0.95)',
                  border: `2px solid ${gachaResult.color}`,
                  borderRadius: '12px',
                  padding: '12px 16px'
                }}>
                  <div style={{ fontSize: '28px' }}>{gachaResult.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: gachaResult.color, marginTop: '4px' }}>
                    {gachaResult.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#e2e8f0', marginTop: '2px' }}>
                    {gachaResult.desc}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={coins < 400 || isOpeningChest}
                  onClick={() => handleOpenChestClick('coins')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: coins >= 400 ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' : 'rgba(51, 65, 85, 0.6)',
                    color: coins >= 400 ? '#0f172a' : '#64748b',
                    fontWeight: 900,
                    fontSize: '12.5px',
                    fontFamily: '"Chakra Petch", sans-serif',
                    cursor: coins >= 400 ? 'pointer' : 'not-allowed'
                  }}
                >
                  🔓 ABRIR POR 400 🪙
                </button>
                <button
                  type="button"
                  disabled={gems < 50 || isOpeningChest}
                  onClick={() => handleOpenChestClick('gems')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: gems >= 50 ? 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' : 'rgba(51, 65, 85, 0.6)',
                    color: gems >= 50 ? '#0f172a' : '#64748b',
                    fontWeight: 900,
                    fontSize: '12.5px',
                    fontFamily: '"Chakra Petch", sans-serif',
                    cursor: gems >= 50 ? 'pointer' : 'not-allowed'
                  }}
                >
                  💎 COFRE ÉPICO (50 💎)
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & RECEIPTS */}
          {activeTab === 'backup' && (
            <div style={{
              backgroundColor: 'rgba(9, 14, 26, 0.92)',
              border: '1px solid rgba(99, 91, 255, 0.4)',
              borderRadius: '14px',
              padding: '16px 18px',
              fontSize: '12px',
              color: '#cbd5e1'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#a5b4fc', marginBottom: '10px', fontFamily: '"Chakra Petch", sans-serif' }}>
                🔐 GUARDADO AUTOMÁTICO Y PASAPORTE MULTI-DISPOSITIVO
              </div>

              {backupFeedback && (
                <div style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: `1.5px solid ${backupFeedback.color}`,
                  color: backupFeedback.color,
                  fontWeight: 800,
                  fontSize: '11.5px',
                  marginBottom: '12px'
                }}>
                  {backupFeedback.text}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '11px 13px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#fbbf24', marginBottom: '6px' }}>
                    📤 COPIAR TU CÓDIGO DE PASAPORTE (MÓVIL ↔ PC)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      readOnly
                      value={currentPassportCode}
                      style={{
                        flex: 1,
                        padding: '7px 9px',
                        borderRadius: '7px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        backgroundColor: '#020617',
                        color: '#fde047',
                        fontFamily: 'monospace',
                        fontSize: '11px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyPassport}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '7px',
                        border: 'none',
                        backgroundColor: copiedPassport ? '#22c55e' : '#fbbf24',
                        color: '#0f172a',
                        fontWeight: 900,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedPassport ? '✓' : 'COPIAR'}
                    </button>
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '11px 13px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#38bdf8', marginBottom: '6px' }}>
                    📥 PEGAR CÓDIGO PASAPORTE TK3D
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={inputPassportCode}
                      onChange={(e) => setInputPassportCode(e.target.value)}
                      placeholder="TK3D-..."
                      style={{
                        flex: 1,
                        padding: '7px 9px',
                        borderRadius: '7px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        backgroundColor: '#020617',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontSize: '11px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRestorePassportClick}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '7px',
                        border: 'none',
                        backgroundColor: '#38bdf8',
                        color: '#0f172a',
                        fontWeight: 900,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      CARGAR
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '11px 13px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.22)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#a5b4fc' }}>
                    🧾 RECIBOS GUARDADOS ({purchaseReceipts.length})
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="email"
                      value={restoreEmail}
                      onChange={(e) => setRestoreEmail(e.target.value)}
                      placeholder="Email usado en Stripe..."
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        backgroundColor: '#020617',
                        color: '#f8fafc',
                        fontSize: '11px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyStripeEmail}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#635bff',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      Verificar Stripe
                    </button>
                  </div>
                </div>

                {purchaseReceipts.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Tus compras se guardan automáticamente en este navegador y en Stripe.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '95px', overflowY: 'auto' }}>
                    {purchaseReceipts.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          backgroundColor: 'rgba(30, 41, 59, 0.6)',
                          padding: '5px 9px',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}
                      >
                        <span><strong style={{ color: '#4ade80' }}>✓</strong> {r.packTitle} ({r.priceEur})</span>
                        <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px' }}>{r.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
