$ErrorActionPreference = 'Stop'

$project = 'D:\DermaSathiAI-Frontend-Lab\dermasathi frontend design'
$sourceRoot = 'D:\AI-Tools\skill-sources'
$skillsRoot = Join-Path $project '.agents\skills'

if (-not (Test-Path -LiteralPath $project)) {
    throw "Project folder not found: $project"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required. Install/use Git for Windows, then rerun.'
}

New-Item -ItemType Directory -Force -Path $sourceRoot, $skillsRoot | Out-Null
Set-Location -LiteralPath $project

function Get-Repo([string]$Name, [string]$Url) {
    $path = Join-Path $sourceRoot $Name
    if (-not (Test-Path -LiteralPath (Join-Path $path '.git'))) {
        if (Test-Path -LiteralPath $path) {
            throw "Source folder exists but is not a Git checkout: $path. Rename it and rerun."
        }
        Write-Host "`nCloning full repository: $Name" -ForegroundColor Cyan
        git clone --depth 1 --quiet $Url $path
        if ($LASTEXITCODE -ne 0) { throw "Git clone failed: $Url" }
    } else {
        Write-Host "Using existing repository checkout: $path" -ForegroundColor DarkGray
    }
    return $path
}

function Install-SkillFolder([string]$Source, [string]$InstallName) {
    $manifest = Join-Path $Source 'SKILL.md'
    if (-not (Test-Path -LiteralPath $manifest)) {
        Write-Warning "SKILL.md not found; skill was NOT installed: $Source"
        return $false
    }
    $destination = Join-Path $skillsRoot $InstallName
    if (Test-Path -LiteralPath $destination) {
        if (Test-Path -LiteralPath (Join-Path $destination 'SKILL.md')) {
            Write-Host "Already installed; left unchanged: $InstallName" -ForegroundColor Yellow
            return $true
        }
        throw "Destination exists but has no SKILL.md: $destination. Inspect it before rerunning."
    }
    New-Item -ItemType Directory -Path $destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }
    if (-not (Test-Path -LiteralPath (Join-Path $destination 'SKILL.md'))) {
        throw "Copy verification failed for skill: $InstallName"
    }
    Write-Host "Installed and verified: $InstallName" -ForegroundColor Green
    return $true
}

$ponytail = Get-Repo 'ponytail' 'https://github.com/DietrichGebert/ponytail.git'
$emil = Get-Repo 'emil-kowalski-skills' 'https://github.com/emilkowalski/skills.git'
$impeccable = Get-Repo 'impeccable' 'https://github.com/pbakaus/impeccable.git'
$taste = Get-Repo 'taste-skill' 'https://github.com/Leonxlnx/taste-skill.git'
$aiDesign = Get-Repo 'ai-design-skills' 'https://github.com/elayadesign/ai-design-skills.git'

$installed = [System.Collections.Generic.List[string]]::new()

# Ponytail: clone the full repo into D:\AI-Tools, install its Agent Skills in the project.
foreach ($name in @('ponytail','ponytail-review','ponytail-audit','ponytail-debt','ponytail-gain','ponytail-help')) {
    if (Install-SkillFolder (Join-Path (Join-Path $ponytail 'skills') $name) $name) { $installed.Add($name) }
}

# Emil Kowalski: preserve each selected skill's bundled references and helper scripts.
foreach ($name in @('emil-design-eng','animate','review-animations','improve-animations','find-animation-opportunities','animation-vocabulary','apple-design','pick-ui-library','prototype')) {
    if (Install-SkillFolder (Join-Path (Join-Path $emil 'skills') $name) $name) { $installed.Add($name) }
}

# Impeccable currently stores its portable skill in .agent (singular) in its source repo.
# We place it in .agents (plural), Antigravity's current default and Kilo's shared discovery path.
$impeccableSource = Join-Path $impeccable '.agent\skills\impeccable'
if (-not (Test-Path -LiteralPath (Join-Path $impeccableSource 'SKILL.md'))) {
    $impeccableSource = Join-Path $impeccable '.agents\skills\impeccable'
}
if (Install-SkillFolder $impeccableSource 'impeccable') { $installed.Add('impeccable') }

# Taste's current skill is design-taste-frontend; preserve its scripts/assets/references.
if (Install-SkillFolder (Join-Path $taste 'skills\taste-skill') 'design-taste-frontend') { $installed.Add('design-taste-frontend') }

# Elaya: focused specifically on the public-facing landing page.
if (Install-SkillFolder (Join-Path $aiDesign 'skills\landing-page-design') 'landing-page-design') { $installed.Add('landing-page-design') }

# Keep a concise always-on Ponytail principle rule for Antigravity, without replacing AGENTS.md.
$rulesDir = Join-Path $project '.agents\rules'
New-Item -ItemType Directory -Force -Path $rulesDir | Out-Null
$ponytailRuleTarget = Join-Path $rulesDir 'ponytail.md'
if (-not (Test-Path -LiteralPath $ponytailRuleTarget)) {
@'
---
trigger: always_on
description: Use Ponytail's efficient, minimal-change engineering discipline on this project.
---
Understand and trace the relevant code before editing. Reuse existing components, dependencies and patterns. Prefer the smallest complete change. Never cut validation at trust boundaries, security, accessibility, meaningful error handling, data-loss safeguards, or tests/checks for non-trivial logic. Avoid unnecessary dependencies and abstractions. State material checks skipped and residual risks.
'@ | Set-Content -LiteralPath $ponytailRuleTarget -Encoding UTF8
    Write-Host 'Created Antigravity-compatible Ponytail rule.' -ForegroundColor Green
}

# Shared workspace instructions. Do not overwrite an existing AGENTS.md.
$agentsFile = Join-Path $project 'AGENTS.md'
if (-not (Test-Path -LiteralPath $agentsFile)) {
@'
# DermaSathiAI Frontend — project instructions

## Project boundary and integration
- This is the standalone frontend lab. Do not modify the separate backend repository.
- Keep backend work behind a typed API/service layer. Use existing mock/demo services until the real FastAPI contracts are supplied.
- Never connect the browser directly to PostgreSQL or invent API routes, payloads, auth rules, or database fields.

## Existing stack and preservation
- Inspect the current implementation before editing. Reuse existing pages, contexts, tokens, CSS modules, mock services and Three.js scenes where suitable.
- Current baseline: React 18, React Three Fiber 8, Three.js, Vite, TypeScript, React Router and Framer Motion. Do not upgrade major versions without proving the need and checking compatibility.
- Keep changes incremental and buildable. Do not delete working features or rewrite the whole project blindly.

## DermaSathiAI visual direction
- Premium, bright, calm, trustworthy healthcare design. Dark/cybersecurity/hacker/neon aesthetics are prohibited.
- Palette is provisional; centralize design tokens for later adjustment.
- Use 3D selectively for hero storytelling, feature demonstrations and appropriate processing states. Do not make every screen heavy.
- Combine 3D, video previews, editorial typography, depth and motion only when they improve the user journey.
- Responsive behavior is mandatory at phone, tablet and desktop sizes. Never rely on hover for essential mobile interactions.
- Respect reduced motion, keyboard accessibility, readable contrast, touch targets and lower-powered phones.

## Healthcare UX and safety
- Build complete frontend journeys for authentication/onboarding, dashboard, skin assessment, symptoms, reports/OCR review, medication safety/reminders, health history, lifestyle/wellness, facility discovery, localization and settings.
- Mock data and simulated AI must be clearly identified as demo content. Never present mock predictions as real diagnoses or verified results.
- Avoid diagnostic certainty and prescribing language. Show uncertainty, warnings, referral and clinician review clearly.
- Forms need validation, loading, success, error, empty and retry states.

## Skill use — apply explicitly when relevant
- Use `ponytail` / `ponytail-review` for minimal, safe implementation and review.
- Use `design-taste-frontend` for an audit-first redesign of the public landing page; do not apply its landing-only rules blindly to clinical dashboards.
- Use `landing-page-design` for public landing-page structure, message hierarchy and conversion flow.
- Use `impeccable` for product brief, critique, audit, accessibility, responsive and final polish; use its bundled helper scripts as documented.
- Use `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, and `find-animation-opportunities` when planning or reviewing purposeful motion.
- Skills are task-specific tools. Do not load or execute every skill/script on every change; explicitly invoke the relevant skills for each work package and report which were applied.

## Implementation discipline
- Prefer existing dependencies and components. Ask before adding heavy libraries or changing major versions.
- After meaningful changes, run the production build and visually inspect at approximately 1440px, 768px and 390px widths.
'@ | Set-Content -LiteralPath $agentsFile -Encoding UTF8
    Write-Host 'Created AGENTS.md project instructions.' -ForegroundColor Green
} else {
    Write-Host 'AGENTS.md already exists; left it unchanged.' -ForegroundColor Yellow
}

Write-Host "`n===== SKILL INSTALL VERIFICATION =====" -ForegroundColor Cyan
$installed | Sort-Object -Unique | ForEach-Object { Write-Host "OK  $_" -ForegroundColor Green }
$missing = @()
Get-ChildItem -LiteralPath $skillsRoot -Directory | ForEach-Object {
    if (-not (Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md'))) { $missing += $_.Name }
}
if ($missing.Count -gt 0) {
    Write-Warning ("These folders do not contain SKILL.md: " + ($missing -join ', '))
}
Write-Host "`nFull repository checkouts are stored in: $sourceRoot" -ForegroundColor Cyan
Write-Host 'Reload Antigravity and Kilo Code with this exact project folder opened.' -ForegroundColor Green
