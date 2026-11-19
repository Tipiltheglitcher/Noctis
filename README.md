# Noctis

Application moderne en mode noir absolu pour **Windows (PC)** et **Android**, avec connexion **Lycée Connecté / ENT (ÉduConnect)** et **QR Code (+ PIN)**, et mises à jour automatiques via GitHub Releases.

- **Site de téléchargement (toujours à jour)** : https://tipiltheglitcher.github.io/Noctis/
- **Toutes les versions (`.exe` + `.apk`)** : https://github.com/Tipiltheglitcher/Noctis/releases

## Structure du dépôt

- `PC/` : Application Windows Electron + React + TypeScript (`Noctis-*-Setup.exe`)
- `Mobile/` : Application Android Capacitor + React + WebView ENT native (`Noctis-*.apk`)
- `Site-Web/` : Site vitrine & téléchargement déployé automatiquement sur GitHub Pages
- `.github/workflows/` : Compilation automatique de Windows `.exe` + Android `.apk` à chaque tag `vX.Y.Z`, et déploiement automatique du site web.

## Publier une nouvelle mise à jour (pour tes potes)

Depuis PowerShell à la racine (`D:\Script\app\pronote`) :

```powershell
.\scripts\publish-update.ps1 -Version "1.0.1" -Notes "Corrections et améliorations"
```

GitHub Actions compile automatiquement `Noctis-1.0.1-Setup.exe` et `Noctis-1.0.1.apk`, publie la Release, met à jour le site web, et **Noctis PC + Noctis Android proposent automatiquement la mise à jour au prochain démarrage** !
