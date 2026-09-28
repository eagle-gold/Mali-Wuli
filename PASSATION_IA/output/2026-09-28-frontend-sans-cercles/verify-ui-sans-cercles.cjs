/* Local read-only verification. React SSR and effects use fixtures; no API, auth or database. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const frontend = "/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/frontend";
const sourceRoot = process.argv[2] || path.join(__dirname, "staging/src");
const ts = require(path.join(frontend, "node_modules/typescript"));
const React = require(path.join(frontend, "node_modules/react"));
const { renderToStaticMarkup } = require(path.join(frontend, "node_modules/react-dom/server"));
let unexpectedApiCalls = 0;

const person = {
  prenom: "Awa", nom: "Diarra",
  profil: {
    id: "in-memory-profile", titre: "Médecin", ville: "Bamako", pays: "Mali",
    stats: { nbSynergies: 3, nbContributions: 5 },
    cercles: [{ id: "legacy-payload", nom: "Ancien cercle" }],
  },
};
const mocks = {
  react: React,
  "react/jsx-runtime": require(path.join(frontend, "node_modules/react/jsx-runtime")),
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  "next/image": ({ priority, unoptimized, ...props }) => React.createElement("img", props),
  "next/navigation": { usePathname: () => "/dashboard", useRouter: () => ({ push() {}, replace() {} }) },
  "lucide-react": require(path.join(frontend, "node_modules/lucide-react")),
  "@/hooks/useSocket": { useSocket: () => null, fermerSocket() {} },
  "@/lib/api": {
    get() { unexpectedApiCalls += 1; throw new Error("Unexpected API call"); },
    post() { unexpectedApiCalls += 1; throw new Error("Unexpected API call"); },
  },
  "@/lib/media": { urlMediaBackend: (value) => value || null },
  // Notifications are reviewed separately; their mounted effects are outside this test.
  "@/components/notifications/NotificationsPopover": () => null,
};

function load(relative, transform = (source) => source, overrides = {}) {
  const source = transform(fs.readFileSync(path.join(sourceRoot, relative), "utf8"));
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const imports = { ...mocks, ...overrides };
  vm.runInNewContext(code, {
    require(id) { assert(id in imports, `Unmocked import ${id}`); return imports[id]; },
    module, exports: module.exports, console, URL, AbortController, Date, setTimeout, clearTimeout,
  });
  return module.exports;
}

async function main() {
  const feed = load("components/feed/ActualiteFeed.tsx", (source) => source
    .replace("utilisateur: null,", `utilisateur: ${JSON.stringify(person)},`)
    .replace("useState(true);", "useState(false);")
    .replace("const [chargementFil, setChargementFil] = useState(true);", "const [chargementFil, setChargementFil] = useState(false);")
    + "\nexport { ColonneProfil, ColonneSuggestions };");
  const profileHtml = renderToStaticMarkup(React.createElement(feed.ColonneProfil, {
    utilisateur: person, chargement: false, erreur: "", reessayer() {},
  }));
  const suggestionsHtml = renderToStaticMarkup(React.createElement(feed.ColonneSuggestions, {
    suggestions: [{ id: "suggestion-fixture", user: { prenom: "Moussa", nom: "Traoré" }, titre: "Ingénieur", ville: "Ségou" }],
    evenements: [{ id: "event-fixture", titre: "Rencontre réseau", lieu: "Bamako", dateDebut: "2026-10-18T12:00:00Z" }],
    chargement: false, erreur: "", reessayer() {}, actualiser: async () => {},
  }));
  const feedHtml = renderToStaticMarkup(React.createElement(feed.default));
  const header = load("components/MaliWuliHeader.tsx", (source) => source.replaceAll("useState(false)", "useState(true)"));
  const headerHtml = renderToStaticMarkup(React.createElement(header.MemberHeader));
  for (const html of [profileHtml, suggestionsHtml, feedHtml, headerHtml]) assert(!/cercl|Discussions/i.test(html));
  assert.match(profileHtml, /Awa Diarra/);
  assert.match(profileHtml, /Contributions au réseau/);
  assert.match(profileHtml, /href="\/profil"/);
  assert.match(suggestionsHtml, /Moussa Traoré/);
  assert.match(suggestionsHtml, /Rencontre réseau/);
  assert.match(suggestionsHtml, /Proposer une synergie/);
  const filters = feedHtml.match(/<nav aria-label="Filtres du fil"[\s\S]*?<\/nav>/)[0];
  assert.equal((filters.match(/<button/g) || []).length, 3);
  for (const label of ["Tout", "Mon pays", "Ma ville"]) assert(filters.includes(label));
  assert.match(headerHtml, /Navigation membre mobile/);
  for (const href of ["/dashboard", "/annuaire", "/synergies", "/evenements", "/offres", "/education", "/profil", "/messages"]) {
    assert(headerHtml.includes(`href="${href}"`));
  }
  assert.equal(unexpectedApiCalls, 0);

  const effects = [];
  const calls = [];
  let panels;
  const fixtures = {
    "/users/me": person,
    "/evenements": { evenements: [{ id: "event-fixture" }] },
    "/synergies/suggestions": { suggestions: [{ id: "suggestion-fixture" }] },
    "/publications": { publications: [] },
  };
  const mounted = load("components/feed/ActualiteFeed.tsx", undefined, {
    react: {
      ...React,
      useCallback: (callback) => callback,
      useEffect: (callback) => effects.push(callback),
      useState(initial) {
        let value = typeof initial === "function" ? initial() : initial;
        return [value, (update) => {
          value = typeof update === "function" ? update(value) : update;
          if (value && typeof value === "object" && "utilisateur" in value) panels = value;
        }];
      },
    },
    "@/lib/api": { get: async (url, config) => {
      assert(url in fixtures, `Unexpected mocked endpoint ${url}`);
      calls.push({ url, params: config?.params });
      return { data: fixtures[url] };
    } },
  });
  mounted.default();
  for (const effect of effects) effect();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls.map((call) => call.url).sort(), Object.keys(fixtures).sort());
  assert.equal(panels.utilisateur.profil.id, "in-memory-profile");
  assert.equal(panels.evenements[0].id, "event-fixture");
  assert.equal(panels.suggestions[0].id, "suggestion-fixture");
  assert(!("cercles" in panels));
  const publicationCall = calls.find((call) => call.url === "/publications");
  assert.equal(publicationCall.params.scope, "tout");
  assert.equal(publicationCall.params.filtre, "tout");

  console.log(JSON.stringify({
    status: "passed", sourceRoot,
    checks: ["profile-ignores-legacy-circle-payload", "suggestions-and-events-render", "three-feed-filters", "desktop-and-mobile-member-navigation", "panel-request-result-alignment"],
    mockedRequests: calls.map((call) => call.url), networkCalls: 0, databaseWrites: 0, filesWrittenByTest: 0,
    limitations: ["SSR uses fixture hooks and mock Next components", "No browser geometry or notification checks"],
  }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
