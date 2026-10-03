# 🌍 Mali Wuli — « Le réseau qui unit les talents du Mali et de sa diaspora »

> **Mali Wuli** signifie « Mali, lève-toi » en bambara.  
> Plateforme numérique du projet **Amélioration du Capital Humain Malien**.

---

## 📌 Présentation

Mali Wuli connecte les talents qui vivent au Mali et ceux de la diaspora (France, Canada, États-Unis, Afrique de l'Ouest…) pour créer des synergies concrètes : orientation, mentorat, emploi, entraide et groupes de réflexion.

---

## 🏗️ Architecture du projet

```
mali-wuli/
├── frontend/          → Next.js 15 + React + Tailwind CSS
├── backend/           → Node.js + Express + Prisma + MySQL
├── .gitignore
└── README.md
```

---

## 🚀 Stack technique

| Partie       | Technologie                        |
|--------------|------------------------------------|
| Frontend     | Next.js 15, React, Tailwind CSS    |
| Backend      | Node.js, Express, TypeScript       |
| Base de données | MySQL + Prisma ORM              |
| Auth         | JWT + Bcrypt                       |
| Temps réel   | Socket.io                          |
| Emails       | Nodemailer                         |

---

## ⚙️ Installation

### Prérequis
- Node.js 22
- MySQL 8
- npm 10

### 1. Cloner le projet
```bash
git clone https://github.com/eagle-gold/mali-wuli.git
cd mali-wuli
```

### 2. Lancer le backend
```bash
cd backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run education:seed
npm run dev
```

### 3. Lancer le frontend
```bash
cd frontend
cp .env.local.example .env.local
npm ci
npm run dev
```

---

## 🌐 Accès local

| Service   | URL                      |
|-----------|--------------------------|
| Frontend  | http://localhost:3000    |
| Backend   | http://localhost:5000    |

---

## 👥 Rôles utilisateurs

| Rôle                  | Description                                      |
|-----------------------|--------------------------------------------------|
| Visiteur              | Accès à la vitrine publique uniquement           |
| Membre                | Accès complet dès la création du compte          |
| Volontaire            | Propose des créneaux de mentorat                 |
| Président de cercle   | Anime un cercle thématique                       |
| Responsable asso.     | Valide les affiliations à son association        |
| Modérateur            | Modère les contenus et signalements              |
| Administrateur        | Gestion totale de la plateforme                  |

---

## 📁 Espaces de la plateforme

- 🏠 **Accueil** — Tableau de bord personnalisé
- 👥 **Annuaire** — Recherche et profils des membres
- 🔗 **Synergies** — Mises en relation
- 💬 **Messagerie** — Conversations privées et groupes
- 📅 **Agenda** — RDV, réunions, événements
- 🎓 **Volontaires** — Mentorat réservable
- 🔵 **Cercles** — Think tanks thématiques
- 📚 **Éducation** — Fiches établissements (forum et associations à venir)
- 🎉 **Événements** — En présentiel et en ligne
- 💼 **Offres d'emploi** — CDI, CDD, stage, freelance
- 📸 **Albums photo**

---

## 📄 Documentation

- [`Specification_Fonctionnelle_Mali_Wuli.md`](./Specification_Fonctionnelle_Mali_Wuli.md) — Spécification fonctionnelle complète
- [`backend/SOCIAL_API.md`](./backend/SOCIAL_API.md) — fil, commentaires, messagerie, notifications et temps réel
- [`backend/COMMUNITY_API.md`](./backend/COMMUNITY_API.md) — cercles, événements, offres et mentorat

## Déploiement

### Frontend

Les variables `NEXT_PUBLIC_*` sont intégrées au JavaScript au moment du build.
Définissez les URL publiques dans Hostinger avant de compiler ou redéployer :

```bash
NEXT_PUBLIC_API_URL=https://floralwhite-ram-987223.hostingersite.com/api \
NEXT_PUBLIC_SOCKET_URL=https://floralwhite-ram-987223.hostingersite.com \
npm run build --prefix frontend
```

N'incluez pas `frontend/.env.local` dans les archives de déploiement : ce fichier
contient les adresses du développement local. Modifier les variables après le
build ne corrige pas les bundles déjà générés. Le build refuse désormais les
URL localhost/loopback et l'absence d'URL API publique. Pour tester volontairement
un build de production sur une machine locale, utilisez
`ALLOW_LOCAL_PRODUCTION_BUILD=true` ; cette exception ne doit pas être activée
sur Hostinger.

### Backend

La production utilise exclusivement `prisma migrate deploy`. Ne lancez jamais
`prisma migrate dev` ni `prisma db push` sur la base Hostinger. Sur une base
historique qui possède déjà les tables de la migration initiale, marquez une
seule fois la baseline comme appliquée avant de déployer les migrations
additives :

```bash
npx prisma migrate resolve --applied 20260919000000_production_baseline
npx prisma migrate deploy
```

---

*Version 1.0 — Août 2026*
