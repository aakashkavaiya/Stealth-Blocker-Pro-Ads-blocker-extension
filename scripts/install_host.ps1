# Stealth Blocker Host Registry Installer
# Registers the Rust native backend host for Google Chrome and Microsoft Edge.

param (
    [string]$ExtensionId = ""
)

$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$scriptsDir\.."
$manifestPath = "$scriptsDir\stealth_blocker_host.json"

# Detect absolute binary path (check release first, then debug)
$binaryPath = "$projectRoot\native-backend\target\release\stealth_blocker_host.exe"
if (-not (Test-Path $binaryPath)) {
    $binaryPath = "$projectRoot\native-backend\target\debug\stealth_blocker_host.exe"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " STEALTH BLOCKER HOST INSTALLER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot"
Write-Host "Binary Path:  $binaryPath"
Write-Host "Manifest:     $manifestPath"

# Validate manifest exists
if (-not (Test-Path $manifestPath)) {
    Write-Error "Host manifest not found at $manifestPath"
    exit 1
}

# Update host manifest JSON with absolute path and extension ID
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$manifest.path = $binaryPath.Replace("\", "\\")

if (-not [string]::IsNullOrEmpty($ExtensionId)) {
    Write-Host "Registering Extension ID: $ExtensionId" -ForegroundColor Yellow
    $manifest.allowed_origins = @("chrome-extension://$ExtensionId/")
} else {
    Write-Host "No Extension ID provided. Allowed origins remains default." -ForegroundColor Gray
}

$manifest | ConvertTo-Json -Depth 5 | Out-File $manifestPath -Encoding utf8
Write-Host "Updated manifest file with correct binary and extension permissions." -ForegroundColor Green

# Register in Windows Registry under Current User (does not require admin privileges!)
$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.stealth.blocker",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.stealth.blocker"
)

foreach ($regPath in $registryPaths) {
    $parentPath = Split-Path $regPath -Parent
    
    # Create registry key folder if it doesn't exist
    if (-not (Test-Path $parentPath)) {
        New-Item -Path (Split-Path $parentPath -Parent) -Name (Split-Path $parentPath -Leaf) -Force | Out-Null
    }
    if (-not (Test-Path $regPath)) {
        New-Item -Path $parentPath -Name (Split-Path $regPath -Leaf) -Force | Out-Null
    }
    
    # Set default value of registry key to point to manifest file
    Set-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestPath -Force
    Write-Host "Registered: $regPath" -ForegroundColor Green
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installation Complete! Please reload your extension." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
