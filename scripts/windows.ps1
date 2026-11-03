param([ValidateSet('start', 'build', 'dev')][string]$Mode = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

try {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
        if (Test-Path -LiteralPath $bundledNode) {
            $nodeCommand = Get-Item -LiteralPath $bundledNode
            $env:PATH = (Split-Path -Parent $bundledNode) + ';' + $env:PATH
        }
    }
    if (-not $nodeCommand) { throw 'Node.js 20.9 or newer is required. Install Node.js LTS from https://nodejs.org, then reopen this script.' }
    $nodePath = if ($nodeCommand.Source) { $nodeCommand.Source } else { $nodeCommand.FullName }
    $nodeVersion = [version]((& $nodePath --version).Trim().TrimStart('v'))
    if ($nodeVersion -lt [version]'20.9.0') { throw 'Node.js is too old. Install Node.js LTS (20.9 or newer).' }
    $env:CI = 'true'

    if (-not (Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) {
        $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
        $bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
        if ($npmCommand) {
            Write-Host 'Installing locked dependencies with npm ci...'
            & $npmCommand.Source ci --legacy-peer-deps
        } elseif ($pnpmCommand) {
            & $pnpmCommand.Source install --frozen-lockfile --ignore-scripts
        } elseif (Test-Path -LiteralPath $bundledPnpm) {
            & $bundledPnpm install --frozen-lockfile --ignore-scripts
        } else { throw 'npm or pnpm is required. Reinstall Node.js LTS with npm enabled.' }
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your network and retry.' }
    }

    $env:NEXT_TELEMETRY_DISABLED = '1'
    if ($Mode -eq 'dev') {
        & $nodePath 'node_modules\next\dist\bin\next' dev --webpack --hostname 127.0.0.1
        exit $LASTEXITCODE
    }
    & $nodePath 'node_modules\next\dist\bin\next' build --webpack
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    & $nodePath 'scripts\build-pwa.mjs'
    if ($LASTEXITCODE -ne 0) { throw 'Offline cache generation failed.' }
    if ($Mode -eq 'build') {
        Write-Host 'Production output is ready in out/. Upload the contents to HTTPS static hosting.'
        exit 0
    }
    & $nodePath 'scripts\serve-static.mjs'
    exit $LASTEXITCODE
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
