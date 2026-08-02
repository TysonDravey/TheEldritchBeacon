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

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion(),
    NEXT_PUBLIC_BUILD_SHA: gitShortSha(),
  },
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
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
