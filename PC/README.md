# Noctis

Application de bureau Windows (`.exe`) moderne et sombre pour votre espace scolaire PRONOTE, avec connexion **ENT / Lycée Connecté (ÉduConnect)** et **QR Code (+ PIN)**.

## Fonctionnalités

- **Connexion Lycée Connecté automatique** : ouvre directement ÉduConnect (ou l'écran de connexion Lycée Connecté), détecte automatiquement votre établissement PRONOTE après connexion et récupère votre session.
- **Recherche d'établissement** : recherche par ville, code postal, nom du lycée ou URL PRONOTE.
- **Connexion QR Code** : collez directement une capture d'écran (`Win+Shift+S` puis `Ctrl+V`), glissez une image ou scannez à la webcam + code PIN à 4 chiffres.
- **Session persistante chiffrée** : le jeton de connexion est chiffré localement via Windows DPAPI (`safeStorage`).
- **Tableau de bord, Emploi du temps, Devoirs, Notes + Simulateur de moyenne, Vie scolaire, Infos & Messagerie, Cantine**.
- **Style Obsidian Noir** : 4 couleurs d'accentuation et notifications Windows.

## Lancer ou recompiler

```bash
# Mode développement
npm run dev

# Générer les exécutables Windows (Portable + Setup) dans release/
npm run dist
```
