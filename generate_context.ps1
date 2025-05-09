# generate_context.ps1 - improved version
$projectDir = "C:\Users\MiniMonster\CascadeProjects\LaboELALLALI\laboelallali"
Set-Location -Path $projectDir
$outputFile = "context.txt"

# Start with a fresh file
"# Laboratoire El Allali PWA - Project Context" | Out-File -FilePath $outputFile -Encoding utf8

# Config and doc files to always include
$specificFiles = @(
    "next.config.js",
    "tailwind.config.js",
    "package.json",
    ".env.local",
    "README.md",
    "PLANNING.md",
    "TASK.md",
    "WORKFLOW.md"
)

# Process specific files first
foreach ($filePath in $specificFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -Encoding utf8 | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# Add code files automatically by extension
$codeFiles = Get-ChildItem -Path $projectDir -Recurse -Include "*.ts","*.tsx","*.js","*.jsx","*.css" |
    Where-Object {
        -not $_.FullName.Contains("node_modules") -and 
        -not $_.FullName.Contains(".next") -and
        -not $_.FullName.Contains("public")
    }

foreach ($file in $codeFiles) {
    $relativePath = $file.FullName.Substring($projectDir.Length + 1)
    
    # Skip files we've already processed
    if ($specificFiles -contains $relativePath) {
        continue
    }
    
    "`n## FILE: $relativePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
    "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    Get-Content -Path $file.FullName -Raw -Encoding utf8 | Out-File -FilePath $outputFile -Append -Encoding utf8
    "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
}

Write-Host "Context file generated at: $outputFile"
Write-Host "Included $(($specificFiles | Where-Object { Test-Path (Join-Path -Path $projectDir -ChildPath $_) }).Count) specific files and $($codeFiles.Count) code files"