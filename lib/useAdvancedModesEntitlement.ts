'use client';

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADVANCED_MODES_PRODUCT_ID, getEntitlements, getProducts, purchaseProduct, restorePurchases } from './purchases';
import { isAdvancedModesUnlockedCached, setAdvancedModesUnlockedCache, ADVANCED_MODES_CHANGED_EVENT } from './storage';
import { track } from './track';

// Shared between PuzzleClient.tsx (the enforcement gate), app/page.tsx (the
// locked-card UX), and app/settings/page.tsx (Restore Purchases) — kept in
// one place rather than reimplemented per file (see memory/session history
// on that exact mistake with earlier Lantern-economy work).
export function useAdvancedModesEntitlement() {
  const [unlocked, setUnlocked] = useState(() => !Capacitor.isNativePlatform() || isAdvancedModesUnlockedCached());
  const [price, setPrice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntitlements().then(ids => {
      const owned = ids.includes(ADVANCED_MODES_PRODUCT_ID);
      setUnlocked(owned || !Capacitor.isNativePlatform());
      setAdvancedModesUnlockedCache(owned);
    });
    getProducts([ADVANCED_MODES_PRODUCT_ID]).then(products => {
      setPrice(products[0]?.displayPrice ?? null);
    });
    const onChange = (e: Event) => setUnlocked((e as CustomEvent<boolean>).detail || !Capacitor.isNativePlatform());
    window.addEventListener(ADVANCED_MODES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ADVANCED_MODES_CHANGED_EVENT, onChange);
  }, []);

  const purchase = useCallback(async () => {
    setPurchasing(true);
    setError(null);
    const result = await purchaseProduct(ADVANCED_MODES_PRODUCT_ID);
    setPurchasing(false);
    if (result.success) {
      setUnlocked(true);
      setAdvancedModesUnlockedCache(true);
      track('iap_purchased', { product_id: ADVANCED_MODES_PRODUCT_ID });
    } else if (!result.cancelled) {
      setError('Purchase failed — please try again.');
    }
  }, []);

  const restore = useCallback(async () => {
    await restorePurchases();
    const ids = await getEntitlements();
    const owned = ids.includes(ADVANCED_MODES_PRODUCT_ID);
    setUnlocked(owned || !Capacitor.isNativePlatform());
    setAdvancedModesUnlockedCache(owned);
    if (!owned) setError('No previous purchase found.');
  }, []);

  return { unlocked, price, purchasing, error, purchase, restore };
}
