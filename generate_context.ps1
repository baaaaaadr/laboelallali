# generate_context.ps1 - Scalable Version for Git Repository
# Get current directory rather than hardcoded path to make it portable across computers
$projectDir = $PSScriptRoot
Set-Location -Path $projectDir
$outputFile = "context_for_ai.txt"
$fileSizeLimit = 102400  # 100KB limit for file size

# Counter for tracking total files
$script:totalFilesIncluded = 0 # Use script scope for global-like access within functions

# Start with a fresh file
"# Laboratoire El Allali PWA - AI Context - $(Get-Date)" | Out-File -FilePath $outputFile -Encoding utf8

# --- Project Overview Info ---
"`n## --- PROJECT OVERVIEW ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Laboratoire El Allali - Medical laboratory website in Agadir, Morocco" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Built with Next.js App Router, TypeScript, Tailwind CSS, i18n (fr, ar), and Firebase Hosting" | Out-File -FilePath $outputFile -Append -Encoding utf8

# Function to process files with appropriate syntax highlighting
function Add-FileToContext($filePath, $defaultLangHint = "", $sectionName = "") {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath -PathType Leaf) { # Ensure it's a file
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
    "i18n.ts" # Assuming this is in the project root
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

# --- Section 4: App Routes and Pages ---
$script:currentSection = "APP ROUTES AND PAGES"
"`n## --- $script:currentSection ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

# 1. Add globals.css (not language-specific)
Add-FileToContext "src/app/globals.css"

# 2. Find essential layout.tsx and page.tsx within each language directory
$appLangBasePath = Join-Path -Path $projectDir -ChildPath "src/app"
if (Test-Path -Path $appLangBasePath -PathType Container) {
    Get-ChildItem -Path $appLangBasePath -Directory | ForEach-Object {
        $langDirName = $_.Name
        # Basic check for plausible lang directory (e.g., 2-3 chars, or matches your supportedLngs if you want to be stricter)
        # You could add a filter here: if ("fr", "ar" -contains $langDirName) { ... }
        # For now, we'll assume any direct subdirectory under src/app is a language folder if it contains layout.tsx or page.tsx
        
        $layoutPath = "src/app/$langDirName/layout.tsx"
        $pagePath = "src/app/$langDirName/page.tsx"
        
        # Only try to add if they actually exist to avoid "NOT FOUND" for other non-lang folders in src/app
        if (Test-Path (Join-Path -Path $projectDir -ChildPath $layoutPath) -PathType Leaf) {
            Add-FileToContext $layoutPath
        } else {
            # Output a (NOT FOUND) only if we expect it, e.g., if $langDirName is 'fr' or 'ar'
            if ("fr", "ar" -contains $langDirName) { # Adjust "fr", "ar" to your actual language codes
                 "`n## FILE: $layoutPath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
            }
        }
        
        if (Test-Path (Join-Path -Path $projectDir -ChildPath $pagePath) -PathType Leaf) {
            Add-FileToContext $pagePath
        } else {
            if ("fr", "ar" -contains $langDirName) { # Adjust "fr", "ar" to your actual language codes
                "`n## FILE: $pagePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
            }
        }
    }
} else {
    Write-Warning "Base app directory not found: $appLangBasePath. Cannot find language-specific layouts and pages."
}

# 3. Auto-discover additional pages (iterating through language directories)
$maxPageFilesPerLang = 3 # Limit to a few other page files per language

if (Test-Path -Path $appLangBasePath -PathType Container) {
    Get-ChildItem -Path $appLangBasePath -Directory | ForEach-Object {
        $langDir = $_ # This is a DirectoryInfo object for the language folder (e.g., 'fr', 'ar')
        # Again, consider filtering for actual language directories if needed
        # if ("fr", "ar" -notcontains $langDir.Name) { return } 

        $currentLangPagesPath = $langDir.FullName
        $pageCountInLang = 0
        
        # Get pages, excluding layout.tsx and page.tsx as they are handled above
        Get-ChildItem -Path $currentLangPagesPath -Recurse -File -Include "*.tsx", "*.ts", "*.jsx", "*.js" |
        Where-Object { 
            $_.Name -ne "layout.tsx" -and $_.Name -ne "page.tsx" -and $pageCountInLang -lt $maxPageFilesPerLang 
        } |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($projectDir.Length + 1).Replace("\", "/")
            if (Add-FileToContext $relativePath) {
                $pageCountInLang++
            }
        }
    }
}

# --- Section 5: Auto-discover components by categories ---
$componentsBasePath = Join-Path -Path $projectDir -ChildPath "src/components"
if (Test-Path -Path $componentsBasePath -PathType Container) {
    $componentCategories = @(
        @{Path = "layout"; Name = "LAYOUT COMPONENTS"; Limit = 3},
        @{Path = "providers"; Name = "PROVIDER COMPONENTS"; Limit = 2},
        @{Path = "features"; Name = "FEATURE COMPONENTS"; Limit = 5}, # Increased limit for features
        @{Path = "ui"; Name = "UI COMPONENTS"; Limit = 3}
    )

    foreach ($category in $componentCategories) {
        $categoryPath = Join-Path -Path $componentsBasePath -ChildPath $category.Path
        if (Test-Path -Path $categoryPath -PathType Container) {
            # Set section for the category
            $script:currentSection = "" # Reset to ensure new section header is printed
            Add-FileToContext "" "" $category.Name # Call with empty file to print section header

            $componentCount = 0
            Get-ChildItem -Path $categoryPath -Recurse -File -Include "*.tsx", "*.ts", "*.jsx", "*.js" |
            Sort-Object Name | # Optional: sort for consistency
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
# Set section for Firebase Functions
$script:currentSection = "" # Reset to ensure new section header is printed
Add-FileToContext "" "" "FIREBASE FUNCTIONS" # Call with empty file to print section header

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
Write-Host "Context includes $script:totalFilesIncluded files (skipping files larger than $($fileSizeLimit / 1024)KB)"