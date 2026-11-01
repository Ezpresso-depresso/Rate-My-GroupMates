param([int]$Port = 5173, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'

# Use an installed Node first, then the existing Codex runtime. No global setup changes.
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nodePath)) {
    throw 'Node.js is not installed. Install Node.js 24 or newer, then run npm ci in frontend.'
}
$vitePackage = Join-Path $PSScriptRoot 'node_modules\vite\package.json'
if (-not (Test-Path -LiteralPath $vitePackage)) {
    throw 'Frontend dependencies are missing. Run npm ci in frontend first.'
}
$originalPath = $env:PATH
Push-Location -LiteralPath $PSScriptRoot
try {
    $env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    $launcherArgs = @((Join-Path $PSScriptRoot 'scripts\start-afterparty.mjs'), '--port', "$Port")
    if ($NoOpen) { $launcherArgs += '--no-open' }
    & $nodePath @launcherArgs
    $launcherExitCode = $LASTEXITCODE
} finally {
    $env:PATH = $originalPath
    Pop-Location
}
exit $launcherExitCode
