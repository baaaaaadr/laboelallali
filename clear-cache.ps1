# Clear Next.js cache and restart development server
Write-Host "Clearing Next.js cache..." -ForegroundColor Yellow

# Stop any running Next.js processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Remove .next directory
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host ".next directory removed" -ForegroundColor Green
}

# Remove node_modules/.cache if it exists
if (Test-Path "node_modules/.cache") {
    Remove-Item -Path "node_modules/.cache" -Recurse -Force
    Write-Host "Node modules cache cleared" -ForegroundColor Green
}

# Clear npm cache
npm cache clean --force
Write-Host "NPM cache cleared" -ForegroundColor Green

Write-Host "Cache clearing complete! Now run 'npm run dev' to restart the development server." -ForegroundColor Green