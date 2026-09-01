import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

// A checked-in counter, not derived from git history — Vercel's build does a
// shallow clone, so `git rev-list --count HEAD` only sees a handful of recent
// commits there and reports a small, wrong number. Bump data/buildVersion.json
// by hand (or via a script) on every push instead.
function buildVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), "data", "buildVersion.json"), "utf-8");
    return String(JSON.parse(raw).version);
  } catch {
    return "?";
  }
}

function gitShortSha(): string {
  // Vercel provides the real commit SHA directly — no git history walk needed,
  // so it's unaffected by clone depth. Fall back to a local git call for dev.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "?";
  }
}

// Set by `npm run build:ios` only. Produces a fully static `out/` folder for
// Capacitor to embed in the iOS app — no Node server ships on a phone, so
// this build can't use rewrites, API routes, or the on-demand image
// optimizer. The regular `npm run build` (Vercel/web) is unaffected.
const MOBILE_BUILD = process.env.MOBILE_BUILD === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion(),
    NEXT_PUBLIC_BUILD_SHA: gitShortSha(),
    // No server on a phone to run the /ingest proxy rewrite below, so
    // PostHog has to be told to hit its collection endpoint directly.
    NEXT_PUBLIC_MOBILE_BUILD: MOBILE_BUILD ? "1" : "",
  },
  ...(MOBILE_BUILD
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          return [
            {
              source: "/ingest/static/:path*",
              destination: "https://us-assets.i.posthog.com/static/:path*",
            },
            {
              source: "/ingest/array/:path*",
              destination: "https://us-assets.i.posthog.com/array/:path*",
            },
            {
              source: "/ingest/:path*",
              destination: "https://us.i.posthog.com/:path*",
            },
          ];
        },
      }),
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
