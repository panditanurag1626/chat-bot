# =====================================================================
#  ChatBotAI - Windows fix for:  "...better_sqlite3.node is not a valid
#  Win32 application"
#
#  Root cause: node_modules was copied from a macOS zip (note the
#  __MACOSX folder). better-sqlite3 ships a NATIVE prebuilt binary
#  (build/Release/better_sqlite3.node). The copy in node_modules is a
#  macOS (Mach-O) binary, which Windows cannot load.
#
#  Fix: remove node_modules / stale .next, reinstall on Windows so
#  prebuild-install downloads the Windows x64 binary, then verify the
#  native module loads. package-lock.json is KEPT and installed with
#  `npm ci` so the exact pinned dependency tree is reproduced.
#  (Add -PurgeLock to also delete package-lock.json and re-resolve.)
#
#  Run:   powershell -ExecutionPolicy Bypass -File .\fix-windows.ps1
# =====================================================================
param([switch]$PurgeLock)
$ErrorActionPreference = "Stop"

function Say([string]$msg) { Write-Host $msg }
function Fail([string]$msg) { Write-Host "`n[FATAL] $msg" -ForegroundColor Red; exit 1 }

Say "===== Step 1/6: Locate Node.js / npm ====="
$nodeBin = (Get-Command node -ErrorAction SilentlyContinue)
$npmBin  = (Get-Command npm  -ErrorAction SilentlyContinue)
if (-not $nodeBin) { Fail "node not found. Install Node.js 20, 22, or 24 LTS from https://nodejs.org then re-run this script." }
if (-not $npmBin)  { Fail "npm not found. Reinstall Node.js (it bundles npm)." }

$nodeVer  = (node --version)
$npmVer   = (npm --version)
Say "node: $nodeVer   npm: $npmVer"

$nodeMajor = 0
if ($nodeVer -match "^v?(\d+)\.") { $nodeMajor = [int]$Matches[1] }
if ($nodeMajor -lt 18) {
    Fail "Node $nodeVer is too old for this project (needs 18+). Install Node.js 18/20/22/24 LTS from https://nodejs.org, reopen the terminal, then re-run this script."
}
if ($nodeMajor -lt 20) {
    Say "[INFO] Node $nodeVer is below 20 - OK because package.json uses better-sqlite3 ^11.x (Node 18+)."
} else {
    Say "Node major $nodeMajor - supported by better-sqlite3 11.x and 12.x."
}

Say "`n===== Step 2/6: Stop this project's dev server (if running) ====="
# Only kill node processes that are running NEXT DEV for THIS project
# (path contains the project folder) - do not touch unrelated node apps.
$projectPath = (Get-Location).Path
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$projectPath*" -and $_.CommandLine -like "*next*" } |
    ForEach-Object {
        Say "Stopping dev server PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Say "`n===== Step 3/6: Remove old (macOS) dependencies ====="
$targets = @("node_modules", ".next")
if ($PurgeLock) { $targets += "package-lock.json" }
foreach ($t in $targets) {
    if (Test-Path -LiteralPath $t) {
        Say "Removing $t ..."
        Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction Continue
    }
}

Say "`n===== Step 4/6: Fresh install on Windows ====="
if ($PurgeLock) {
    Say "> npm install  (re-resolving dependency tree)"
    npm install
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed (exit $LASTEXITCODE)." }
} else {
    Say "> npm ci  (exact install from package-lock.json)"
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Say "[WARN] npm ci failed - package.json and package-lock.json are out of sync."
        Say "> Falling back to npm install (regenerates the lockfile)..."
        npm install
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed (exit $LASTEXITCODE)." }
    }
}

Say "`n===== Step 5/6: Force the correct Windows native binary ====="
Say "> npm rebuild better-sqlite3  (re-runs prebuild-install / node-gyp)"
npm rebuild better-sqlite3
if ($LASTEXITCODE -ne 0) { Fail "npm rebuild better-sqlite3 failed (exit $LASTEXITCODE)." }

Say "`n===== Step 6/6: Verify the native module ====="
try {
    $out = node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.exec('CREATE TABLE t(a INTEGER)'); db.prepare('INSERT INTO t VALUES (1)').run(); const r=db.prepare('SELECT a FROM t').get(); console.log('better-sqlite3 native module LOADED and working. value =', r.a); db.close();" 2>&1
    Say "> node verify: $out"
    if ($out -match "LOADED and working") {
        Say "`n===== SUCCESS ====="
        Say "Native better-sqlite3 binary for Windows installed correctly."
        Say "Start the app with:  npm run dev"
        Say "Or check DB with:     npm run db:check"
    } else {
        Say "`n[WARNING] better-sqlite3 loaded but unexpected output: $out"
    }
} catch {
    Say "`n[WARNING] Verification threw: $_"
    Say "If the error mentions node-gyp / MSBuild, the prebuilt download failed and a source"
    Say "build was attempted. Install these and re-run `npm install` in this folder:"
    Say "  - Visual Studio 2022 Build Tools -> 'Desktop development with C++' workload"
    Say "  - https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022"
    Say "  - Python 3.x (node-gyp requires it): https://www.python.org/downloads/"
    Say "  - Then set for npm:  npm config set msvs_version 2022"
}
