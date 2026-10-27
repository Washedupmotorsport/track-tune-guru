export function isPreviewHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" ||
    host.endsWith(".localhost") ||
    host === "lovableproject.com" || host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev") ||
    (/\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) &&
      (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(host.split(".")[0] ?? "") ||
       /^project--.+-dev$/.test(host.split(".")[0] ?? "")));
}