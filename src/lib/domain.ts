/**
 * Utilities for multi-tenant subdomain and custom domain detection.
 * Main domain: mrt.llc
 * Subdomain format: https://[slug].mrt.llc
 */

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "dashboard",
  "driver",
  "mail",
  "storefront",
  "assets",
  "static",
]);

export interface TenantHostMatch {
  type: "subdomain" | "custom_domain" | "main";
  identifier: string | null;
}

/**
 * Parses the current hostname to check if it corresponds to a restaurant subdomain or custom domain.
 */
export function getTenantIdentifierFromHost(hostnameInput?: string): TenantHostMatch {
  let hostname = hostnameInput;

  if (!hostname && typeof window !== "undefined") {
    hostname = window.location.hostname;
  }

  if (!hostname) {
    return { type: "main", identifier: null };
  }

  // Strip port if present
  hostname = hostname.split(":")[0].toLowerCase().trim();

  // Plain local host or IP addresses
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".vercel.app")
  ) {
    return { type: "main", identifier: null };
  }

  // Main domain matches (mrt.llc, www.mrt.llc, tamrad.com, www.tamrad.com)
  if (
    hostname === "mrt.llc" ||
    hostname === "www.mrt.llc" ||
    hostname === "tamrad.com" ||
    hostname === "www.tamrad.com"
  ) {
    return { type: "main", identifier: null };
  }

  // Local subdomain testing: e.g. burger.localhost
  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const sub = parts[0];
      if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
        return { type: "subdomain", identifier: sub };
      }
    }
    return { type: "main", identifier: null };
  }

  // Check for mrt.llc subdomain: e.g. burger.mrt.llc
  if (hostname.endsWith(".mrt.llc")) {
    const sub = hostname.replace(/\.mrt\.llc$/, "");
    if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
      return { type: "subdomain", identifier: sub };
    }
    return { type: "main", identifier: null };
  }

  // Check for tamrad.com subdomain: e.g. burger.tamrad.com
  if (hostname.endsWith(".tamrad.com")) {
    const sub = hostname.replace(/\.tamrad\.com$/, "");
    if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) {
      return { type: "subdomain", identifier: sub };
    }
    return { type: "main", identifier: null };
  }

  // Custom domain (e.g. orders.myrestaurant.com)
  return { type: "custom_domain", identifier: hostname };
}

/**
 * Returns the public storefront URL for a tenant.
 */
export function getTenantStorefrontUrl(slug: string, customDomain?: string | null): string {
  if (customDomain && customDomain.trim()) {
    return `https://${customDomain.trim()}`;
  }

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    const cleanHost = hostname.split(":")[0];

    // Local development support
    if (cleanHost === "localhost" || cleanHost.endsWith(".localhost")) {
      const portSuffix = port ? `:${port}` : "";
      return `${protocol}//${slug}.localhost${portSuffix}`;
    }
  }

  return `https://${slug}.mrt.llc`;
}
