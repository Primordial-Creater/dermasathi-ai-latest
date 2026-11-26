$ErrorActionPreference = 'Stop'

$project = 'D:\DermaSathiAI-Frontend-Lab\dermasathi frontend design'
$sourceRoot = 'D:\AI-Tools\skill-sources'
$skillsRoot = Join-Path $project '.agents\skills'

if (-not (Test-Path -LiteralPath $project)) {
    throw "Project folder not found: $project"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required for downloading the skill repositories.'
}

New-Item -ItemType Directory -Force -Path $sourceRoot, $skillsRoot | Out-Null
Set-Location -LiteralPath $project

function Get-Repo([string]$Name, [string]$Url) {
    $path = Join-Path $sourceRoot $Name
    if (-not (Test-Path -LiteralPath (Join-Path $path '.git'))) {
        if (Test-Path -LiteralPath $path) {
            throw "Source folder exists but is not a Git checkout: $path. Rename it and rerun."
        }
        Write-Host "`nCloning $Name..." -ForegroundColor Cyan
        git clone --depth 1 --quiet $Url $path
        if ($LASTEXITCODE -ne 0) { throw "Git clone failed: $Url" }
    } else {
        Write-Host "Using existing source checkout: $path" -ForegroundColor DarkGray
    }
    return $path
}

function Install-SkillFolder([string]$Source, [string]$InstallName) {
    $manifest = Join-Path $Source 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest)) {
        Write-Warning "SKILL.md not found; skipped: $Source"
        return
    }
    $destination = Join-Path $skillsRoot $InstallName
    if (Test-Path -LiteralPath $destination) {
        Write-Host "Already present; leaving untouched: $InstallName" -ForegroundColor Yellow
        return
    }
    New-Item -ItemType Directory -Path $destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $destination -Recurse -Force
    Write-Host "Installed skill: $InstallName" -ForegroundColor Green
}

$ponytail = Get-Repo 'ponytail' 'https://github.com/DietrichGebert/ponytail.git'
$emil = Get-Repo 'emil-kowalski-skills' 'https://github.com/emilkowalski/skills.git'
$impeccable = Get-Repo 'impeccable' 'https://github.com/pbakaus/impeccable.git'
$taste = Get-Repo 'taste-skill' 'https://github.com/Leonxlnx/taste-skill.git'
$aiDesign = Get-Repo 'ai-design-skills' 'https://github.com/elayadesign/ai-design-skills.git'

# Ponytail: code economy without removing validation, security, accessibility or error handling.
foreach ($name in @('ponytail','ponytail-review','ponytail-audit','ponytail-debt','ponytail-gain','ponytail-help')) {
    Install-SkillFolder (Join-Path (Join-Path $ponytail 'skills') $name) $name
}

# Emil Kowalski: only the web design / motion skills relevant to this React project.
foreach ($name in @('emil-design-eng','animate','review-animations','improve-animations','find-animation-opportunities','animation-vocabulary','apple-design','pick-ui-library','prototype')) {
    Install-SkillFolder (Join-Path (Join-Path $emil 'skills') $name) $name
}

# Impeccable: manual skill copy (agent skill works; CLI hooks/subagents are not installed).
Install-SkillFolder (Join-Path $impeccable '.agents\skills\impeccable') 'impeccable'

# Taste: existing-project redesign skill, including its bundled references/scripts.
Install-SkillFolder (Join-Path $taste 'skills\taste-skill') 'design-taste-frontend'

# Elaya: specifically for the public landing page, not every dashboard screen.
Install-SkillFolder (Join-Path $aiDesign 'skills\landing-page-design') 'landing-page-design'

# Ponytail's Antigravity workspace rule file, where supported.
$ponytailRule = Join-Path $ponytail '.agents\rules\ponytail.md'
if (Test-Path -LiteralPath $ponytailRule) {
    $rulesDir = Join-Path $project '.agents\rules'
    New-Item -ItemType Directory -Force -Path $rulesDir | Out-Null
    $ruleTarget = Join-Path $rulesDir 'ponytail.md'
    if (-not (Test-Path -LiteralPath $ruleTarget)) {
        Copy-Item -LiteralPath $ponytailRule -Destination $ruleTarget
        Write-Host 'Installed Ponytail workspace rule.' -ForegroundColor Green
    }
}

# Shared project instructions. Existing root instructions are never overwritten.
$agentsFile = Join-Path $project 'AGENTS.md'
if (-not (Test-Path -LiteralPath $agentsFile)) {
@'
# DermaSathiAI Frontend — project instructions

## Project boundary
- This repository is the standalone frontend lab. Do not modify the separate backend repository.
- Keep backend work behind a typed API/service layer. Use the existing mock adapter/demo mode until real FastAPI contracts are supplied.
- Never connect the browser directly to PostgreSQL or invent API routes, payloads, auth rules, or database fields.

## Existing stack and preservation
- Inspect the current implementation before editing. Reuse existing pages, contexts, tokens, CSS modules, mock services and Three.js scenes where suitable.
- Current baseline is React 18 with React Three Fiber 8, Three.js, Vite, TypeScript, React Router and Framer Motion. Do not upgrade major versions or replace libraries without proving a need and checking compatibility.
- Keep changes scoped, incremental and buildable. Do not rewrite the whole project in one pass or delete working features without a clear reason.

## DermaSathiAI visual direction
- Build a premium, bright, calm, trustworthy healthcare experience. Dark/cybersecurity/hacker/neon aesthetics are prohibited.
- Palette is provisional and can be adjusted after visual review; centralize design tokens rather than hard-coding colors throughout components.
- Use 3D intentionally: hero storytelling, selected feature demonstrations and suitable processing states. Do not place heavy 3D on every screen.
- Combine 3D, video previews, editorial typography, depth, motion and refined micro-interactions only when they improve the user journey.
- Responsive behavior is mandatory at phone, tablet and desktop sizes. Never rely on hover for essential mobile interactions.
- Respect reduced-motion preferences, keyboard accessibility, readable contrast, touch targets and low-powered mobile devices.

## Healthcare UX and safety
- Build complete interface journeys for auth/onboarding, patient dashboard, skin assessment, symptom intake, reports/OCR review, medication safety/reminders, health history, lifestyle/wellness, facility discovery, localization and settings as required by the product brief.
- Mocked data and simulated AI must be visibly identifiable as demo content. Never present mock predictions as real diagnosis or verified medical results.
- Avoid diagnostic certainty and prescribing language. Keep uncertainty, safety warnings, referral and clinician review clear in the UI.
- Forms need validation, loading, success, error, empty and retry states.

## Implementation discipline
- Apply Ponytail: understand the actual flow first; reuse existing code; prefer native platform features and installed dependencies; implement the smallest complete solution.
- Never remove security, trust-boundary validation, data-loss handling, accessibility, error handling or meaningful tests to save tokens or lines.
- Do not add dependencies for functionality already available in the current stack. Ask before adding heavy 3D, animation, charting or UI packages.
- After meaningful changes, run the production build and inspect the browser at approximately 1440px, 768px and 390px widths.

## Skill selection order
- For redesigning the existing application: use `design-taste-frontend` for a targeted current-state audit and one coherent visual direction.
- For the public landing page: consult `landing-page-design` for page structure and messaging.
- Use `impeccable` to establish/critique/polish product-specific design decisions; avoid generic template patterns.
- Use Emil Kowalski's skills for animation choice, easing, timing, mobile interactions and animation performance—not to animate everything.
- Use Ponytail for implementation efficiency and code review. These skills are complementary; do not blindly apply conflicting defaults.
'@ | Set-Content -LiteralPath $agentsFile -Encoding UTF8
    Write-Host 'Created AGENTS.md project instructions.' -ForegroundColor Green
} else {
    Write-Host 'AGENTS.md already exists; left it unchanged.' -ForegroundColor Yellow
}

Write-Host "`n===== INSTALLED SKILLS =====" -ForegroundColor Cyan
Get-ChildItem -LiteralPath $skillsRoot -Directory | Select-Object -ExpandProperty Name
Write-Host "`nSkill source checkouts: $sourceRoot" -ForegroundColor Cyan
Write-Host 'Next: reload Antigravity and Kilo Code with this exact folder opened as the workspace.' -ForegroundColor Green
