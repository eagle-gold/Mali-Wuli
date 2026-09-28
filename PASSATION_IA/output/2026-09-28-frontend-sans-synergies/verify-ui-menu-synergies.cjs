/* Read-only local verification: fixtures, SSR and simulated effects; no auth, network or database. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const frontend = "/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend";
const sourceRoot = process.argv[2] || path.join(frontend, "src");
const ts = require(path.join(frontend, "node_modules/typescript"));
const React = require(path.join(frontend, "node_modules/react"));
const { renderToStaticMarkup } = require(path.join(frontend, "node_modules/react-dom/server"));
const checks = [];
let unexpectedApiCalls = 0;

const person = {
  id: "user-fixture", prenom: "Awa", nom: "Diarra", statut: "VALIDE",
  profil: {
    id: "profile-fixture", titre: "Médecin", ville: "Bamako", pays: "Mali",
    formations: [], experiences: [], estVolontaire: false,
    // Synergies are retained outside the navigation; legacy circles stay hidden.
    stats: { nbSynergies: 99, nbContributions: 5, nbAvis: 2, nbRdvAcceptes: 3 },
    cercles: [{ id: "legacy-circle", nom: "Ancien cercle" }],
  },
};
const event = { id: "event-fixture", titre: "Rencontre réseau", lieu: "Bamako", dateDebut: "2026-10-18T12:00:00Z" };
const directory = {
  membres: [{ id: "member-fixture", user: { prenom: "Awa", nom: "Diarra" }, titre: "Médecin", ville: "Bamako", pays: "Mali", estVolontaire: true }],
  page: 1, limite: 18, total: 20, totalPages: 2,
};
const suggestion = { id: "suggestion-fixture", user: { prenom: "Moussa", nom: "Traoré" }, titre: "Ingénieur", ville: "Ségou" };
const failApi = () => { unexpectedApiCalls += 1; throw new Error("Unexpected API call"); };
const text = (value) => React.createElement("div", null, value);
const mocks = {
  react: React,
  "react/jsx-runtime": require(path.join(frontend, "node_modules/react/jsx-runtime")),
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  "next/image": ({ priority, unoptimized, ...props }) => React.createElement("img", props),
  "next/navigation": {
    usePathname: () => "/dashboard",
    useRouter: () => ({ push() {}, replace() {} }),
    useSearchParams: () => new URLSearchParams("recherche=Awa"),
  },
  "lucide-react": require(path.join(frontend, "node_modules/lucide-react")),
  "@/hooks/useSocket": { useSocket: () => null, fermerSocket() {} },
  "@/hooks/useCountries": { useCountries: () => [{ code: "ML", nom: "Mali", drapeau: "" }] },
  "@/lib/api": { get: failApi, post: failApi, put: failApi, delete: failApi },
  "@/lib/media": { urlMediaBackend: (value) => value || null },
  "@/lib/periode": { trierParDateDebut: (items) => [...items], formaterMoisAnnee: () => "" },
  "@/lib/education/reference": { libelleProgramme: (value) => value || "", libelleSystemeEducatif: (value) => value || "" },
  "@/lib/education/suivi": { avisEtablissementScolaireEstDisponible: () => false },
  "@/lib/community": {
    initiales: (first, last) => `${first?.[0] || ""}${last?.[0] || ""}`,
    nomComplet: (first, last) => [first, last].filter(Boolean).join(" "),
    messageErreur: (_error, fallback) => fallback,
  },
  "@/components/community/CommunityUi": {
    Chargement: ({ texte }) => text(texte), ErreurChargement: ({ message }) => text(message), EtatVide: ({ children }) => text(children),
  },
  "@/components/auth/PlatformAuthGuard": ({ children }) => children,
  // Notifications have their own separate regression suite.
  "@/components/notifications/NotificationsPopover": () => null,
};

function load(relative, { transform = (source) => source, overrides = {} } = {}) {
  const source = transform(fs.readFileSync(path.join(sourceRoot, relative), "utf8"));
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const imports = { ...mocks, ...overrides };
  vm.runInNewContext(code, {
    require(id) { assert(id in imports, `Unmocked import ${id}`); return imports[id]; },
    module, exports: module.exports, console, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout,
  });
  return module.exports;
}

function fixtureReact(values) {
  let index = 0;
  return { ...React, useState(initial) {
    const current = index++;
    return React.useState(Object.hasOwn(values, current) ? values[current] : initial);
  } };
}
function render(component, props = {}) { return renderToStaticMarkup(React.createElement(component, props)); }
function noCircleUi(html) { assert(!/cercl|Discussions/i.test(html)); }
function noSynergyNavigation(html) { noCircleUi(html); assert(!/synerg/i.test(html)); }

async function main() {
  const feed = load("components/feed/ActualiteFeed.tsx", {
    transform: (source) => source + "\nexport { ColonneProfil, ColonneSuggestions };",
  });
  const feedProfileHtml = render(feed.ColonneProfil, { utilisateur: person, chargement: false, erreur: "", reessayer() {} });
  const eventsHtml = render(feed.ColonneSuggestions, { suggestions: [suggestion], actualiser: async () => {}, evenements: [event], chargement: false, erreur: "", reessayer() {} });
  const loadingEventsHtml = render(feed.ColonneSuggestions, { suggestions: [], actualiser: async () => {}, evenements: [], chargement: true, erreur: "", reessayer() {} });
  const feedHtml = render(feed.default);
  for (const html of [feedProfileHtml, eventsHtml, loadingEventsHtml, feedHtml]) noCircleUi(html);
  assert.match(feedProfileHtml, /Awa Diarra/);
  assert.match(feedProfileHtml, /Contributions au réseau/);
  assert.match(feedProfileHtml, /Synergies actives/);
  assert.match(feedProfileHtml, />99<\/dd>/);
  assert.match(eventsHtml, /Moussa Traoré/);
  assert.match(eventsHtml, /Proposer une synergie/);
  assert.match(eventsHtml, /Rencontre réseau/);
  assert.match(eventsHtml, /href="\/evenements"/);
  assert.equal((loadingEventsHtml.match(/animate-pulse/g) || []).length, 2);
  const filters = feedHtml.match(/<nav aria-label="Filtres du fil"[\s\S]*?<\/nav>/)[0];
  assert.equal((filters.match(/<button/g) || []).length, 3);
  for (const label of ["Tout", "Mon pays", "Ma ville"]) assert(filters.includes(label));
  checks.push("feed-retains-synergy-count-suggestions-events-three-filters");

  // Restored profile states: user, suggestions, profile loading, suggestion loading, then errors/media/action state.
  const profile = load("components/profile/ProfilMembre.tsx", { overrides: { react: fixtureReact({ 0: person, 1: [suggestion], 2: false, 3: false }) } });
  const profileHtml = render(profile.default);
  noCircleUi(profileHtml);
  assert.match(profileHtml, /99 synergies/);
  assert.match(profileHtml, /href="\/synergies"/);
  assert.match(profileHtml, /Moussa Traoré/);
  assert.match(profileHtml, /Proposer une synergie/);
  assert.match(profileHtml, /Awa Diarra/);
  assert.match(profileHtml, /contributions au réseau/);
  assert.match(profileHtml, /href="\/onboarding\?etape=informations"/);
  assert.match(profileHtml, /href="\/onboarding\?etape=mentorat"/);
  checks.push("member-profile-retains-synergy-count-and-recommendations");

  const header = load("components/MaliWuliHeader.tsx", { overrides: { react: fixtureReact({ 1: true }) } });
  const headerHtml = render(header.MemberHeader);
  noSynergyNavigation(headerHtml);
  assert.match(headerHtml, /Navigation membre mobile/);
  for (const href of ["/dashboard", "/annuaire", "/evenements", "/offres", "/education", "/profil", "/messages"]) assert(headerHtml.includes(`href="${href}"`));
  assert.match(headerHtml, /role="search"/);
  checks.push("desktop-and-open-mobile-header-keep-search-and-remaining-links");

  const layout = load("app/(platform)/layout.tsx", { overrides: { "@/components/MaliWuliHeader": { MemberHeader: () => null } } });
  const layoutHtml = render(layout.default, { children: text("Contenu membre") });
  noSynergyNavigation(layoutHtml);
  assert.match(layoutHtml, /Contenu membre/);
  for (const href of ["/dashboard", "/agenda", "/messages", "/profil"]) assert(layoutHtml.includes(`href="${href}"`));
  assert.equal((layoutHtml.match(/<a /g) || []).length, 4);
  checks.push("mobile-bottom-navigation-retains-four-links");

  // Directory states: query, applied query, country, status, volunteer, page, response, loading, error.
  const annuaire = load("app/(platform)/annuaire/page.tsx", { overrides: { react: fixtureReact({ 6: directory, 7: false }) } });
  const directoryHtml = render(annuaire.default);
  noCircleUi(directoryHtml);
  assert.match(directoryHtml, /Awa Diarra/);
  assert.match(directoryHtml, /Médecin/);
  assert.match(directoryHtml, /type="search"[^>]*value="Awa"/);
  assert.match(directoryHtml, /Filtrer par pays/);
  assert.match(directoryHtml, /Pagination de l’annuaire/);
  assert.match(directoryHtml, /<form/);
  assert.match(directoryHtml, /Proposer une synergie/);
  checks.push("directory-retains-synergy-action-search-filters-pagination");

  assert.equal(unexpectedApiCalls, 0);

  const effects = [];
  const calls = [];
  const listeners = [];
  let panels;
  const fixtures = { "/synergies/suggestions": { suggestions: [suggestion] }, "/users/me": person, "/evenements": { evenements: [event] }, "/publications": { publications: [] } };
  const mounted = load("components/feed/ActualiteFeed.tsx", { overrides: {
    react: {
      ...React, useCallback: (callback) => callback, useEffect: (callback) => effects.push(callback),
      useState(initial) {
        let value = typeof initial === "function" ? initial() : initial;
        return [value, (update) => {
          value = typeof update === "function" ? update(value) : update;
          if (value && typeof value === "object" && "utilisateur" in value) panels = value;
        }];
      },
    },
    "@/hooks/useSocket": { useSocket: () => ({ on: (eventName) => listeners.push(eventName), off() {} }) },
    "@/lib/api": { get: async (url, config) => {
      assert(url in fixtures, `Unexpected mocked endpoint ${url}`);
      calls.push({ url, params: config?.params }); return { data: fixtures[url] };
    } },
  } });
  mounted.default();
  for (const effect of effects) effect();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls.map((call) => call.url).sort(), Object.keys(fixtures).sort());
  assert.equal(panels.utilisateur.profil.id, "profile-fixture");
  assert.equal(panels.evenements[0].id, "event-fixture");
  assert.equal(panels.suggestions[0].id, "suggestion-fixture");
  assert(!("cercles" in panels));
  assert(!listeners.some((eventName) => /cercl/i.test(eventName)));
  for (const eventName of ["synergie:created", "synergie:updated", "synergie:deleted", "synergie_creee", "synergie_mise_a_jour", "synergie_supprimee"]) assert(listeners.includes(eventName));
  assert(listeners.includes("evenement_modifie"));
  assert(listeners.includes("rendez_vous_modifie"));
  const publicationCall = calls.find((call) => call.url === "/publications");
  assert.equal(publicationCall.params.scope, "tout");
  assert.equal(publicationCall.params.filtre, "tout");
  checks.push("feed-retains-suggestions-api-alignment-and-synergy-listeners");

  console.log(JSON.stringify({
    status: "passed", sourceRoot, checks, mockedRequests: calls.map((call) => call.url),
    socketListeners: listeners, networkCalls: 0, databaseWrites: 0, filesWrittenByTest: 0,
    limitations: ["SSR with fixtures and mocked Next/auth/notification components", "Profile date/reference helpers stubbed for an empty education fixture", "No browser layout or live account verification"],
  }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
