// `npx cap sync` regenerates ios/App/App/capacitor.config.json's
// packageClassList by scanning installed NPM plugin packages -- confirmed
// by hand (2026-10-18) that it unconditionally wipes any class name it
// doesn't recognize that way, every single sync, with no merge. Our custom
// native plugins (PurchasesPlugin, StoreKit) live only as local Swift files
// in CapApp-SPM, not an NPM package, so cap sync can never know about them.
// Run this after every `npx cap sync ios` to patch them back in, idempotently.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOCAL_PLUGIN_CLASSES = ['PurchasesPlugin'];
const CONFIG_PATH = join(process.cwd(), 'ios', 'App', 'App', 'capacitor.config.json');

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
const current = new Set(config.packageClassList ?? []);
const before = current.size;
for (const name of LOCAL_PLUGIN_CLASSES) current.add(name);
config.packageClassList = [...current].sort();
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, '\t') + '\n');

if (current.size !== before) {
  console.log(`[fixCapacitorPlugins] added: ${LOCAL_PLUGIN_CLASSES.join(', ')}`);
} else {
  console.log('[fixCapacitorPlugins] already present, no change needed');
}
