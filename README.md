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
├── frontend/          → Next.js 14 + React + Tailwind CSS
├── backend/           → Node.js + Express + Prisma + PostgreSQL
├── .gitignore
└── README.md
```

---

## 🚀 Stack technique

| Partie       | Technologie                        |
|--------------|------------------------------------|
| Frontend     | Next.js 14, React, Tailwind CSS    |
| Backend      | Node.js, Express, TypeScript       |
| Base de données | PostgreSQL + Prisma ORM         |
| Auth         | JWT + Bcrypt                       |
| Temps réel   | Socket.io                          |
| Emails       | Nodemailer                         |

---

## ⚙️ Installation

### Prérequis
- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### 1. Cloner le projet
```bash
git clone https://github.com/eagle-gold/mali-wuli.git
cd mali-wuli
```

### 2. Lancer le backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

### 3. Lancer le frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
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
| Membre                | Accès complet après validation                   |
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
- 📚 **Éducation** — Forum, fiches établissements, associations
- 🎉 **Événements** — En présentiel et en ligne
- 💼 **Offres d'emploi** — CDI, CDD, stage, freelance
- 📸 **Albums photo**

---

## 📄 Documentation

- [`Specification_Fonctionnelle_Mali_Wuli.md`](./Specification_Fonctionnelle_Mali_Wuli.md) — Spécification fonctionnelle complète

---

*Version 1.0 — Août 2026*
