const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "staging", "frontend");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assertions = [];

function check(label, condition) {
  if (!condition) throw new Error(`ÉCHEC — ${label}`);
  assertions.push(label);
}

const header = read("src/components/MaliWuliHeader.tsx");
const bottom = read("src/components/navigation/NavigationMobile.tsx");
const layout = read("src/app/(platform)/layout.tsx");
const messages = read("src/components/messages/Messagerie.tsx");
const profile = read("src/components/profile/ProfilMembre.tsx");
const social = read("src/components/profile/LiensSociauxProfil.tsx");
const menuStart = header.indexOf('aria-label="Navigation complémentaire mobile et tablette"');
const mobileMenu = header.slice(menuStart, header.indexOf("</nav>", menuStart));

check("la barre basse contient exactement les quatre accès demandés", ["Accueil", "Offres", "Messages", "Profil"].every((label) => bottom.includes(`label: "${label}"`)) && !bottom.includes("Agenda"));
check("la barre basse affiche quatre icônes et un état actif discret", bottom.includes("Home") && bottom.includes("BriefcaseBusiness") && bottom.includes("MessageCircle") && bottom.includes("UserRound") && bottom.includes("h-[3px]"));
check("le mode mobile/tablette reste actif sous 1180 px", bottom.includes("min-[1180px]:hidden") && layout.includes("min-[1180px]:pb-0") && header.includes("min-[1180px]:flex"));
check("le menu secondaire emploie Annuaire et Établissements", header.includes('label: "Annuaire"') && header.includes('label: "Établissements"'));
check("le menu secondaire ne réutilise pas la liste contenant Accueil et Offres", mobileMenu.includes("liensMenuMobile.map") && !mobileMenu.includes("liensMembre.map"));
check("l’icône Messages quitte l’en-tête mobile", /href="\/messages"[\s\S]*?className="relative hidden[\s\S]*?min-\[1180px\]:flex"/.test(header));
check("la navigation basse est branchée dans le layout", layout.includes('import NavigationMobile') && layout.includes("<NavigationMobile />"));

check("la recherche de nouveau message demande une personne", messages.includes("À quelle personne écrivez-vous ?") && messages.includes("Nom d’une personne") && messages.includes("Rechercher une personne"));
check("les formulations métier/membre ont été retirées de ce formulaire", !messages.includes('placeholder="Nom ou métier"') && !messages.includes("Aucun membre trouvé."));

check("le texte Changer votre photo a été retiré", !profile.includes("Changer votre photo") && !profile.includes("Ajoutez votre photo"));
check("le bouton caméra de la photo reste présent et accessible", profile.includes('aria-label="Ajouter ou modifier ma photo"') && profile.includes("<Camera aria-hidden=\"true\" size={18}"));

check("les quatre logos sociaux utilisent leurs silhouettes SVG", ["linkedin", "facebook", "instagram", "tiktok"].every((name) => social.includes(`${name}: \"M`)));
check("le pictogramme générique TikTok a été retiré", !social.includes("Music2") && !social.includes('from "lucide-react"'));
check("chaque marque conserve son nom visible et un lien accessible", social.includes("LogoReseau") && social.includes("nouvel onglet"));

for (const [name, width, height] of [["icon.png", 64, 64], ["apple-icon.png", 180, 180]]) {
  const data = fs.readFileSync(path.join(root, "src/app", name));
  check(`${name} est un PNG ${width}×${height}`, data.slice(1, 4).toString() === "PNG" && data.readUInt32BE(16) === width && data.readUInt32BE(20) === height);
}

console.log(JSON.stringify({ status: "PASS", assertions }, null, 2));
