const { PHASE_PRODUCTION_BUILD } = require("next/constants");

function verifierUrlPublique(nom, obligatoire = false) {
  const valeur = process.env[nom]?.trim();
  let url;
  try {
    if (valeur) url = new URL(valeur);
  } catch {
    // Une URL absente ou invalide est traitée avec le même message explicite.
  }

  if (!valeur && !obligatoire) return;

  // URL normalise aussi les variantes IPv4 telles que 127.1 ou 2130706433.
  const hote = url?.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const estLocal = hote && (
    hote === "localhost" || hote.endsWith(".localhost") ||
    /^127\./.test(hote) || hote === "0.0.0.0" ||
    hote === "::1" || hote === "::" || /^::ffff:7f[0-9a-f]{2}:/.test(hote)
  );

  if (!url || !["http:", "https:"].includes(url.protocol) || estLocal) {
    throw new Error(
      `${nom} doit contenir l'URL publique du backend avant npm run build ` +
      "(avec /api pour NEXT_PUBLIC_API_URL). Les URL localhost et loopback " +
      "ne doivent pas être intégrées au site déployé. Pour un test local " +
      "intentionnel du build de production, utilisez ALLOW_LOCAL_PRODUCTION_BUILD=true.",
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  // La route de recherche des villes lit les fichiers JSON du paquet de
  // localisation dynamiquement. Next.js ne peut pas les détecter pendant le
  // traçage automatique : sans cette inclusion, le build standalone déployé
  // renvoie une erreur 500 dès que l'utilisateur saisit une ville.
  outputFileTracingIncludes: {
    "/api/locations/cities": [
      "./node_modules/@countrystatecity/countries/dist/data/**/*",
    ],
  },
  poweredByHeader: false,
  // L'hébergement mutualisé limite fortement le nombre de processus. Un seul
  // worker évite les erreurs EAGAIN pendant `next build` sans modifier le
  // comportement de l'application servie.
  experimental: { cpus: 1 },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "floralwhite-ram-987223.hostingersite.com",
        pathname: "/uploads/**",
      },
    ],
  },
  async redirects() {
    return [{ source: "/cercles", destination: "/dashboard", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = (phase) => {
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    process.env.ALLOW_LOCAL_PRODUCTION_BUILD !== "true"
  ) {
    // NEXT_PUBLIC_* est figé dans les bundles lors du build, même si
    // l'environnement du serveur est corrigé ensuite.
    verifierUrlPublique("NEXT_PUBLIC_API_URL", true);
    verifierUrlPublique("NEXT_PUBLIC_SOCKET_URL");
  }
  return nextConfig;
};
