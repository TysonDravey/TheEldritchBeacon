import { Capacitor, registerPlugin } from '@capacitor/core';

export const ADVANCED_MODES_PRODUCT_ID = 'com.tysondravey.eldritchbeacon.advancedmodes';
// Single source of truth for which product id grants how many charges --
// both the Settings page's purchase buttons and the post-purchase
// addAutoWardCharges() call read from this instead of each hardcoding it.
export const AUTOWARD_PACK_CHARGES: Record<string, number> = {
  'com.tysondravey.eldritchbeacon.autoward10': 10,
  'com.tysondravey.eldritchbeacon.autoward30': 30,
};
export const AUTOWARD_PACK_PRODUCT_IDS = Object.keys(AUTOWARD_PACK_CHARGES);
export const STREAK_RESCUE_PRODUCT_ID = 'com.tysondravey.eldritchbeacon.streakrescue';

export interface StoreProduct {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
}

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  pending?: boolean;
  productId?: string;
}

interface PurchasesNativePlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreProduct[] }>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<void>;
  getEntitlements(): Promise<{ productIds: string[] }>;
}

const Purchases = registerPlugin<PurchasesNativePlugin>('Purchases');

// Web build (Vercel) can never do IAP -- every exported function below
// checks this first and returns an empty/false result instead of throwing,
// matching lib/haptic.ts's own Capacitor.isNativePlatform() branch.
function native(): boolean {
  return Capacitor.isNativePlatform();
}

export async function getProducts(productIds: string[]): Promise<StoreProduct[]> {
  if (!native()) return [];
  try {
    return (await Purchases.getProducts({ productIds })).products;
  } catch (err) {
    console.error('[purchases] getProducts failed', err);
    return [];
  }
}

export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  if (!native()) return { success: false };
  try {
    return await Purchases.purchase({ productId });
  } catch (err) {
    console.error('[purchases] purchase failed', productId, err);
    return { success: false };
  }
}

export async function restorePurchases(): Promise<void> {
  if (!native()) return;
  try {
    await Purchases.restorePurchases();
  } catch (err) {
    console.error('[purchases] restore failed', err);
  }
}

export async function getEntitlements(): Promise<string[]> {
  if (!native()) return [];
  try {
    return (await Purchases.getEntitlements()).productIds;
  } catch (err) {
    console.error('[purchases] getEntitlements failed', err);
    return [];
  }
}
