$ErrorActionPreference = 'Stop'
$learnmoreRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $learnmoreRoot
$learnmoreNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $learnmoreNode) {
    $learnmoreBundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $learnmoreBundledNode) { $learnmoreNode = [PSCustomObject]@{ Source = $learnmoreBundledNode } }
}
if (-not $learnmoreNode) { throw 'Node.js 22 or newer is required.' }
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    $learnmoreCodexDir = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    $learnmoreCodex = Get-ChildItem -LiteralPath $learnmoreCodexDir -Filter codex.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($learnmoreCodex) { $env:LEARNMORE_CODEX_BIN = $learnmoreCodex.FullName }
}
& $learnmoreNode.Source (Join-Path $learnmoreRoot 'server.mjs')
