#!/usr/bin/env pwsh
# Branchcode installer for Windows
# Usage: iex (iwr -useb https://raw.githubusercontent.com/branchcode/branchcode/main/scripts/install.ps1)

$ErrorActionPreference = "Stop"

$Repo = "branchcode/branchcode"
$InstallDir = "$env:LOCALAPPDATA\Branchcode"

function Write-Step {
    param([string]$Message)
    Write-Host "=> " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Done {
    param([string]$Message)
    Write-Host "[✓] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Err {
    param([string]$Message)
    Write-Host "[✗] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Get latest release
Write-Step "Fetching latest release..."
try {
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
} catch {
    Write-Err "Failed to fetch latest release. Check your internet connection."
    exit 1
}

$Version = $Release.tag_name.TrimStart('v')
$Assets = $Release.assets

# Find the Windows installer (.exe or .msi)
$Asset = $Assets | Where-Object {
    $_.name -match '\.exe$' -or $_.name -match '\.msi$'
} | Select-Object -First 1

if (-not $Asset) {
    Write-Err "No Windows installer found in release $Version"
    exit 1
}

Write-Done "Found Branchcode v$Version"
Write-Step "Downloading $($Asset.name)..."

# Create install directory
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Download installer
$InstallerPath = Join-Path $InstallDir $Asset.name
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $InstallerPath

Write-Done "Downloaded to $InstallerPath"

# Run installer
Write-Step "Installing..."
if ($InstallerPath -match '\.msi$') {
    Start-Process -FilePath "msiexec" -ArgumentList "/i `"$InstallerPath`" /passive" -Wait
} else {
    Start-Process -FilePath $InstallerPath -Wait
}

Write-Done "Branchcode v$Version installed successfully!"
Write-Host ""
Write-Host "You can find Branchcode in your Start menu or at:" -ForegroundColor Gray
Write-Host "  $InstallDir" -ForegroundColor Gray
