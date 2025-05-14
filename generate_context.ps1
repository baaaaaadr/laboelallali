# generate_context.ps1 - Scalable Version for Git Repository
# Get current directory rather than hardcoded path to make it portable across computers
$projectDir = $PSScriptRoot
Set-Location -Path $projectDir
$outputFile = "context_for_ai.txt"
$fileSizeLimit = 102400  # 100KB limit for file size

# Counter for tracking total files
$totalFilesIncluded = 0

# Start with a fresh file
"# Laboratoire El Allali PWA - AI Context - $(Get-Date)" | Out-File -FilePath $outputFile -Encoding utf8

# --- Project Overview Info ---
"`n## --- PROJECT OVERVIEW ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Laboratoire El Allali - Medical laboratory website in Agadir, Morocco" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Built with Next.js App Router, TypeScript, Tailwind CSS, i18n (fr, ar), and Firebase Hosting" | Out-File -FilePath $outputFile -Append -Encoding utf8

# Function to process files with appropriate syntax highlighting
function Add-FileToContext($filePath, $defaultLangHint = "", $sectionName = "") {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        # Skip large files
        $fileInfo = Get-Item -Path $fullPath
        if ($fileInfo.Length -gt $fileSizeLimit) {
            "`n## FILE: $filePath (SKIPPED - TOO LARGE: $([math]::Round($fileInfo.Length / 1024)) KB)" | Out-File -FilePath $outputFile -Append -Encoding utf8
            return $false
        }

        # Add section heading if provided and it's the first file in this section
        if (-not [string]::IsNullOrEmpty($sectionName) -and $script:currentSection -ne $sectionName) {
            "`n## --- $sectionName ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
            $script:currentSection = $sectionName
        }

        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        
        # Determine language hint for markdown based on extension
        $langHint = $defaultLangHint
        if ([string]::IsNullOrEmpty($langHint)) {
            if ($filePath.EndsWith(".tsx") -or $filePath.EndsWith(".ts")) { $langHint = "typescript" }
            elseif ($filePath.EndsWith(".jsx") -or $filePath.EndsWith(".js")) { $langHint = "javascript" }
            elseif ($filePath.EndsWith(".css")) { $langHint = "css" }
            elseif ($filePath.EndsWith(".json")) { $langHint = "json" }
            elseif ($filePath.EndsWith(".md")) { $langHint = "markdown" }
        }
        
        "``````$langHint" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
        
        $script:totalFilesIncluded++
        return $true
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
        return $false
    }
}

# Track current section to avoid repeating section headers
$script:currentSection = ""

# --- Section 1: Core Configuration Files ---
$script:currentSection = "CORE CONFIGURATION"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

$coreConfigFiles = @(
    "package.json",
    "next.config.js",
    "tailwind.config.js",
    "tsconfig.json",
    "firebase.json",
    ".firebaserc",
    "firestore.rules",
    "storage.rules",
    "i18n.ts"
)

# Process core config files
foreach ($filePath in $coreConfigFiles) {
    Add-FileToContext $filePath
}

# Documentation files
$docFiles = @(
    "README.md"
)

# Process documentation files
foreach ($filePath in $docFiles) {
    Add-FileToContext $filePath "markdown"
}

# --- Section 2: Internationalization (i18n) Setup ---
$script:currentSection = "I18N SETUP"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

$i18nFiles = @(
    "src/middleware.ts",
    "src/i18n.server.ts"
)
foreach ($filePath in $i18nFiles) {
    Add-FileToContext $filePath "typescript"
}

# --- Section 3: Sample Translation Files (1-2 files per language max) ---
$script:currentSection = "SAMPLE TRANSLATIONS"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

$sampleLocaleFiles = @(
    "public/locales/fr/common.json",
    "public/locales/ar/common.json"
)
foreach ($filePath in $sampleLocaleFiles) {
    Add-FileToContext $filePath "json"
}

# --- Section 4: Automatically find app routes/pages ---
$script:currentSection = "APP ROUTES AND PAGES"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

# These are the essential files that should always be included
$essentialRouteFiles = @(
    "src/app/globals.css",
    "src/app/[lang]/layout.tsx",
    "src/app/[lang]/page.tsx"
)

# Process essential app files first
foreach ($filePath in $essentialRouteFiles) {
    Add-FileToContext $filePath
}

# Auto-discover additional pages (but limit the count for context size)
$pagesPath = Join-Path -Path $projectDir -ChildPath "src/app/[lang]"
if (Test-Path -Path $pagesPath) {
    $maxPageFiles = 5 # Limit to the first 5 page files (to avoid context bloat)
    $pageCount = 0
    
    Get-ChildItem -Path $pagesPath -Recurse -Include "*.tsx", "*.ts", "*.jsx", "*.js" |
    Where-Object { $_.Name -ne "layout.tsx" -and $pageCount -lt $maxPageFiles } |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($projectDir.Length + 1).Replace("\", "/")
        if (Add-FileToContext $relativePath) {
            $pageCount++
        }
    }
}

# --- Section 5: Auto-discover components by categories ---
$componentsBasePath = Join-Path -Path $projectDir -ChildPath "src/components"
if (Test-Path -Path $componentsBasePath) {
    $componentCategories = @(
        @{Path = "layout"; Name = "LAYOUT COMPONENTS"; Limit = 3},
        @{Path = "providers"; Name = "PROVIDER COMPONENTS"; Limit = 2},
        @{Path = "features"; Name = "FEATURE COMPONENTS"; Limit = 3},
        @{Path = "ui"; Name = "UI COMPONENTS"; Limit = 3}
    )

    foreach ($category in $componentCategories) {
        $categoryPath = Join-Path -Path $componentsBasePath -ChildPath $category.Path
        if (Test-Path -Path $categoryPath) {
            $script:currentSection = $category.Name
            "`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
            
            $componentCount = 0
            Get-ChildItem -Path $categoryPath -Recurse -Include "*.tsx", "*.ts", "*.jsx", "*.js" |
            Where-Object { $componentCount -lt $category.Limit } |
            ForEach-Object {
                $relativePath = $_.FullName.Substring($projectDir.Length + 1).Replace("\", "/")
                if (Add-FileToContext $relativePath) {
                    $componentCount++
                }
            }
        }
    }
}

# --- Section 6: Firebase Functions ---
$script:currentSection = "FIREBASE FUNCTIONS"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

$functionsFiles = @(
    "functions/src/index.ts",
    "functions/package.json"
)
foreach ($filePath in $functionsFiles) {
    Add-FileToContext $filePath
}

# --- End of Context ---
"`n## --- END OF CONTEXT ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
"`n## Total files included: $script:totalFilesIncluded" | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "AI Context file generated at: $outputFile"
Write-Host "Context includes $script:totalFilesIncluded files (skipping files larger than 100KB)"
Write-Host "Context is now auto-discovering new pages and components as your project grows"