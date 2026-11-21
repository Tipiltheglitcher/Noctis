# Noctis (Windows PC)

Application de bureau Windows (`.exe`) moderne et sombre pour **PRONOTE**, avec connexion **ENT (tous établissements)**, **QR Code (+ PIN)**, mode hors ligne et mises à jour automatiques.

## Fonctionnalités

- **Connexion universelle** : recherche d'établissement via l'annuaire officiel de l'Éducation nationale, connexion ENT intégrée, QR Code PRONOTE (`Win+Shift+S` + `Ctrl+V` / webcam) ou identifiants directs.
- **Session persistante chiffrée & Mode hors ligne** : jeton chiffré localement via Windows DPAPI (`safeStorage`) et cache local persistant.
- **Tableau de bord, Emploi du temps, Devoirs, Notes + Simulateur de moyenne, Vie scolaire, Infos & Sondages, Discussions, Cantine (Midi/Soir)**.
- **Studio de personnalisation** : couleurs libres (HEX / sélecteur), 5 fonds sombres, formes, styles de cartes, disposition et notifications Windows.

## Développement & Compilation

```bash
# Mode développement
npm run dev

# Générer l'installeur Windows (Noctis-*-Setup.exe) dans release/
npm run dist
```
