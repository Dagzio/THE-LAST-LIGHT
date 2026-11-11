// Shop heals for the keeper (D52, user decision 2026-11-11). One-off purchases in the kiosk, between waves only:
// `pct` of max HP at once, final prices in coins (no SHOP_PRICE_MULT). Not offered at full HP.
export const HEALS = {
  bandage: { id: 'bandage', nameKey: 'heal.bandage', pct: 0.1, price: 10 },
  medkit: { id: 'medkit', nameKey: 'heal.medkit', pct: 0.5, price: 50 },
  big_medkit: { id: 'big_medkit', nameKey: 'heal.big_medkit', pct: 1, price: 100 },
};

export const HEAL_ORDER = ['bandage', 'medkit', 'big_medkit'];
