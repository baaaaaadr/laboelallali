# generate_context.ps1 - Enhanced Version (excludes .env.local)
$projectDir = "H:\my apps\laboelallali"
Set-Location -Path $projectDir
$outputFile = "context_for_ai.txt"

# Start with a fresh file
"# Laboratoire El Allali PWA - AI Context - $(Get-Date)" | Out-File -FilePath $outputFile -Encoding utf8

# --- Section 1: Core Configuration Files ---
"`n## --- CORE CONFIGURATION ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$coreConfigFiles = @(
    "package.json",
    "next.config.js",
    "tailwind.config.js",
    "tsconfig.json",
    "postcss.config.js",
    "firebase.json",
    ".firebaserc"
    # Removed ".env.local" from here
)
# Also remove from any other general lists if present (though it wasn't in the Get-ChildItem loop)

# Documentation files (safe to include)
$docFiles = @(
    "README.md",
    "PLANNING.md", # If they exist and are relevant
    "TASK.md",
    "WORKFLOW.md"
)

# Process core config files
foreach ($filePath in $coreConfigFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8 # General block
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# Process documentation files
foreach ($filePath in $docFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````md" | Out-File -FilePath $outputFile -Append -Encoding utf8 # Markdown block
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}


# --- Section 2: Internationalization (i18n) Setup ---
"`n## --- I18N SETUP ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$i18nFiles = @(
    "i18n.ts", 
    "src/middleware.ts", 
    "src/types/next-i18next.d.ts" # Or your custom i18n type definitions
)
foreach ($filePath in $i18nFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````ts" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# --- Section 3: Public Locales (Translation Files) ---
"`n## --- PUBLIC LOCALES ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$localesPath = Join-Path -Path $projectDir -ChildPath "public\locales"
if (Test-Path -Path $localesPath) {
    Get-ChildItem -Path $localesPath -Recurse -Include "*.json" | ForEach-Object {
        $relativePath = $_.FullName.Substring($projectDir.Length + 1)
        "`n## FILE: $relativePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````json" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $_.FullName -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
} else {
    "`n## Path: $localesPath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
}


# --- Section 4: Core App Structure (Layouts and Key Pages) ---
"`n## --- CORE APP STRUCTURE (Layouts, Key Pages) ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$appStructureFiles = @(
    "src/app/layout.tsx",
    "src/app/globals.css",
    "src/app/page.tsx", 
    "src/app/[lang]/layout.tsx",
    "src/app/[lang]/page.tsx"
)
foreach ($filePath in $appStructureFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        # Determine language hint for markdown based on extension
        $langHint = ""
        if ($filePath.EndsWith(".tsx")) { $langHint = "tsx" }
        elseif ($filePath.EndsWith(".css")) { $langHint = "css" }
        "``````$langHint" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# --- Section 5: Key Reusable Components (Header, Footer, Providers) ---
"`n## --- KEY REUSABLE COMPONENTS ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$keyComponents = @(
    "src/components/layout/Header.tsx",
    "src/components/layout/Footer.tsx",
    "src/components/providers/TranslationsProvider.tsx"
)
foreach ($filePath in $keyComponents) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````tsx" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# --- Section 6: Firebase Functions ---
"`n## --- FIREBASE FUNCTIONS ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$functionsFiles = @(
    "functions/src/index.ts", 
    "functions/package.json",
    "functions/tsconfig.json" 
)
foreach ($filePath in $functionsFiles) {
    $fullPath = Join-Path -Path $projectDir -ChildPath $filePath
    if (Test-Path -Path $fullPath) {
        "`n## FILE: $filePath" | Out-File -FilePath $outputFile -Append -Encoding utf8
        $langHint = ""
        if ($filePath.EndsWith(".ts")) { $langHint = "ts" }
        elseif ($filePath.EndsWith(".json")) { $langHint = "json" }
        "``````$langHint" | Out-File -FilePath $outputFile -Append -Encoding utf8
        Get-Content -Path $fullPath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
        "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    } else {
        "`n## FILE: $filePath (NOT FOUND)" | Out-File -FilePath $outputFile -Append -Encoding utf8
    }
}

# --- Section 7: Environment Variable Structure (DO NOT INCLUDE ACTUAL VALUES) ---
"`n## --- ENVIRONMENT VARIABLE STRUCTURE (.env.example or similar) ---" | Out-File -FilePath $outputFile -Append -Encoding utf8
$envExamplePath = Join-Path -Path $projectDir -ChildPath ".env.example"
if (Test-Path -Path $envExamplePath) {
    "`n## FILE: .env.example" | Out-File -FilePath $outputFile -Append -Encoding utf8
    "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
    Get-Content -Path $envExamplePath -Raw -ErrorAction SilentlyContinue | Out-File -FilePath $outputFile -Append -Encoding utf8
    "``````" | Out-File -FilePath $outputFile -Append -Encoding utf8
} else {
    "`n## No .env.example found. Describe required NEXT_PUBLIC_ variables if any." | Out-File -FilePath $outputFile -Append -Encoding utf8
    "# Example: NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here" | Out-File -FilePath $outputFile -Append -Encoding utf8
    "# IMPORTANT: Do NOT share actual .env.local values." | Out-File -FilePath $outputFile -Append -Encoding utf8
}

# --- End of Context ---
"`n## --- END OF CONTEXT ---" | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "AI Context file generated at: $($projectDir)\$outputFile"