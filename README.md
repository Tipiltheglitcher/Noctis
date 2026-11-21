# Noctis

Client scolaire open-source, rapide et en noir absolu pour **PRONOTE**, disponible sur **Web** (PC, Mac, iPhone, Android), **Windows** et **Android**.

- **Noctis Web** : https://tipiltheglitcher.github.io/Noctis/
- **Téléchargement Windows & Android** : https://tipiltheglitcher.github.io/Noctis/download.html
- **Toutes les releases (`.exe` & `.apk`)** : https://github.com/Tipiltheglitcher/Noctis/releases
- **Mentions légales & Confidentialité** : https://tipiltheglitcher.github.io/Noctis/legal.html

## Fonctionnalités

- **Connexion universelle** : recherche d'établissement sur l'annuaire officiel de l'Éducation nationale, connexion **ENT intégrée** (sur Windows & Android), **QR Code PRONOTE** et identifiants directs.
- **Emploi du temps moderne** : cours en cours mis en valeur avec barre de progression, cours passés grisés, pause déjeuner identifiée et passage automatique au jour suivant une fois les cours terminés.
- **Devoirs, Notes & Simulateur** : suivi des devoirs, moyennes par matière et simulateur de futures notes en direct.
- **Infos, Sondages, Discussions & Cantine** : compatible PRONOTE 2026, affichage séparé Midi / Soir (Internat) et indicateur de Droit à la déconnexion.
- **Mode hors ligne (PC & Android)** : consultation des dernières données sans connexion et resynchronisation automatique au retour du réseau.
- **Studio de personnalisation** : couleurs personnalisées (HEX / sélecteur libre), 5 fonds sombres, formes, style de cartes, densité et disposition sur mesure.

## Structure du dépôt

- `PC/` : Application Windows (Electron + React + TypeScript)
- `Mobile/` : Application Android (Capacitor + React + TypeScript)
- `Site-Web/` : Application Noctis Web, portail de téléchargement, mentions légales et relais CORS sans état (`cloudflare-worker/worker.js`)

## Confidentialité & Non-affiliation

Noctis est un projet indépendant open-source **non affilié à Index-Éducation (PRONOTE®)**. Aucun identifiant, mot de passe ou donnée scolaire n'est stocké sur un serveur distant.
