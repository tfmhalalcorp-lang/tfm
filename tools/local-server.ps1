<#
  Minimal static file server for local testing of the frontend/ folder.
  No Node.js / Python required — uses .NET's HttpListener, built into Windows.

  Why this exists: the frontend uses ES modules (<script type="module">),
  which browsers refuse to load over file:// (double-clicking index.html
  directly gives a blank page). Any real http:// origin fixes this — this
  script is the zero-install way to get one on Windows.
#>
param(
    [string]$Root = (Join-Path $PSScriptRoot "..\frontend"),
    [int]$Port = 8080
)

$Root = (Resolve-Path $Root).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    Write-Host "Could not start on port $Port (already in use?). Trying 8090..."
    $Port = 8090
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start()
}

Write-Host "OrderCenter is running at http://localhost:$Port/"
Write-Host "Press Ctrl+C in this window to stop the server."
Start-Process "http://localhost:$Port/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".webmanifest" = "application/manifest+json"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    try {
        $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
        if ($path -eq "/") { $path = "/index.html" }
        $filePath = Join-Path $Root ($path.TrimStart("/"))

        if ((Test-Path $filePath -PathType Leaf)) {
            $resolved = (Resolve-Path $filePath).Path
            if (-not $resolved.StartsWith($Root)) {
                $res.StatusCode = 403
            } else {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $ct = $mime[$ext]
                if (-not $ct) { $ct = "application/octet-stream" }
                $res.ContentType = $ct
                $bytes = [System.IO.File]::ReadAllBytes($resolved)
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $res.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch {
        try { $res.StatusCode = 500 } catch {}
    } finally {
        $res.OutputStream.Close()
    }
}
