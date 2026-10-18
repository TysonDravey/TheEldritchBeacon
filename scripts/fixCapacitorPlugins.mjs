// `npx cap sync` regenerates ios/App/App/capacitor.config.json's
// packageClassList by scanning installed NPM plugin packages -- confirmed
// by hand (2026-10-18) that it unconditionally wipes any class name it
// doesn't recognize that way, every single sync, with no merge. Our custom
// native plugins (PurchasesPlugin, AnalyticsPlugin) live only as local Swift
// files in CapApp-SPM, not an NPM package, so cap sync can never know about
// them. Run this after every `npx cap sync ios` to patch them back in,
// idempotently.
//
// Same problem, same fix, for ios/App/CapApp-SPM/Package.swift: cap sync
// fully regenerates that file too ("DO NOT MODIFY -- managed by Capacitor
// CLI commands" is its own header comment) from a template that only knows
// about NPM-installed Capacitor plugin packages, so AnalyticsPlugin.swift's
// posthog-ios dependency gets wiped the same way packageClassList does.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOCAL_PLUGIN_CLASSES = ['PurchasesPlugin', 'AnalyticsPlugin'];
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

const PACKAGE_SWIFT_PATH = join(process.cwd(), 'ios', 'App', 'CapApp-SPM', 'Package.swift');
let packageSwift = readFileSync(PACKAGE_SWIFT_PATH, 'utf-8');
let patchedPackageSwift = false;

if (!packageSwift.includes('posthog-ios')) {
  packageSwift = packageSwift.replace(
    /(\.package\(name: "CapacitorHaptics", path: "\.\.\/\.\.\/\.\.\/node_modules\/@capacitor\/haptics"\))(\s*)\n(\s*\])/,
    `$1,\n        .package(url: "https://github.com/PostHog/posthog-ios.git", from: "3.59.3")$2\n$3`,
  );
  patchedPackageSwift = true;
}
if (!packageSwift.includes('package: "posthog-ios"')) {
  packageSwift = packageSwift.replace(
    /(\.product\(name: "CapacitorHaptics", package: "CapacitorHaptics"\))(\s*)\n(\s*\]\s*\n\s*\))/,
    `$1,\n                .product(name: "PostHog", package: "posthog-ios")$2\n$3`,
  );
  patchedPackageSwift = true;
}
if (patchedPackageSwift) {
  writeFileSync(PACKAGE_SWIFT_PATH, packageSwift);
  console.log('[fixCapacitorPlugins] patched Package.swift: added posthog-ios dependency');
} else {
  console.log('[fixCapacitorPlugins] Package.swift already has posthog-ios, no change needed');
}
