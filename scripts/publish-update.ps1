param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$cleanVer = $Version.Trim().TrimStart('v', 'V')
$tag = "v$cleanVer"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[Noctis] Mise a jour de la version vers $cleanVer..." -ForegroundColor Cyan

foreach ($pkgRel in @("PC/package.json", "Mobile/package.json")) {
  $pkgPath = Join-Path $root $pkgRel
  $json = Get-Content $pkgPath -Raw | ConvertFrom-Json
  $json.version = $cleanVer
  $json | ConvertTo-Json -Depth 10 | Set-Content -Path $pkgPath -Encoding UTF8
}

git add PC/package.json Mobile/package.json
git commit -m "chore: release $tag"
$tagMsg = if ($Notes) { $Notes } else { "Noctis $tag" }
git tag -a $tag -m $tagMsg
git push origin main
git push origin $tag

Write-Host "[Noctis] Tag $tag pousse ! GitHub Actions compile automatiquement Setup.exe + .apk." -ForegroundColor Green
Write-Host "Suis la compilation sur : https://github.com/Tipiltheglitcher/Noctis/actions" -ForegroundColor Gray
