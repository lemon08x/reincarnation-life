[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CreatorPath,
    [switch]$AllowVersionMismatch,
    [switch]$Wait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$packageJsonPath = Join-Path $projectRoot 'package.json'

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json was not found in project root: $projectRoot"
}

$packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
$expectedVersion = [string]$packageJson.creator.version

if ([string]::IsNullOrWhiteSpace($expectedVersion)) {
    throw 'package.json does not declare creator.version.'
}

function Resolve-CreatorExecutable {
    param([Parameter(Mandatory = $true)][string]$Path)

    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path.Trim('"'))
    if (Test-Path -LiteralPath $expandedPath -PathType Container) {
        $expandedPath = Join-Path $expandedPath 'CocosCreator.exe'
    }

    if (-not (Test-Path -LiteralPath $expandedPath -PathType Leaf)) {
        return $null
    }

    return (Resolve-Path -LiteralPath $expandedPath).Path
}

function Get-CreatorVersion {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    $versionInfo = (Get-Item -LiteralPath $ExecutablePath).VersionInfo
    if (-not [string]::IsNullOrWhiteSpace($versionInfo.ProductVersion)) {
        return $versionInfo.ProductVersion.Trim()
    }
    return $versionInfo.FileVersion.Trim()
}

$candidatePaths = [System.Collections.Generic.List[string]]::new()

if (-not [string]::IsNullOrWhiteSpace($CreatorPath)) {
    $candidatePaths.Add($CreatorPath)
} else {
    if (-not [string]::IsNullOrWhiteSpace($env:COCOS_CREATOR_PATH)) {
        $candidatePaths.Add($env:COCOS_CREATOR_PATH)
    }

    if (-not [string]::IsNullOrWhiteSpace($env:ProgramData)) {
        $creatorInstallRoot = Join-Path $env:ProgramData 'cocos\editors\Creator'
        $candidatePaths.Add((Join-Path $creatorInstallRoot "$expectedVersion\CocosCreator.exe"))

        if (Test-Path -LiteralPath $creatorInstallRoot -PathType Container) {
            Get-ChildItem -LiteralPath $creatorInstallRoot -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending |
                ForEach-Object {
                    $candidatePaths.Add((Join-Path $_.FullName 'CocosCreator.exe'))
                }
        }
    }

    $command = Get-Command 'CocosCreator.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) {
        $candidatePaths.Add($command.Source)
    }

    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $candidatePaths.Add((Join-Path $env:LOCALAPPDATA 'Programs\CocosCreator\CocosCreator.exe'))
        $candidatePaths.Add((Join-Path $env:LOCALAPPDATA 'CocosCreator\CocosCreator.exe'))
    }

    if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
        $candidatePaths.Add((Join-Path $env:ProgramFiles 'CocosCreator\CocosCreator.exe'))
    }
}

$installations = @(
    $candidatePaths |
        Select-Object -Unique |
        ForEach-Object {
            $executable = Resolve-CreatorExecutable -Path $_
            if ($null -ne $executable) {
                [PSCustomObject]@{
                    Path = $executable
                    Version = Get-CreatorVersion -ExecutablePath $executable
                }
            }
        }
)

if ($installations.Count -eq 0) {
    throw @"
Cocos Creator was not found.
Install Creator $expectedVersion with Cocos Dashboard, set COCOS_CREATOR_PATH,
or pass -CreatorPath 'C:\path\to\CocosCreator.exe'.
"@
}

$selected = $installations |
    Where-Object { $_.Version -eq $expectedVersion -or $_.Version.StartsWith("$expectedVersion.") } |
    Select-Object -First 1

if ($null -eq $selected) {
    $selected = $installations | Select-Object -First 1
}

$versionMatches = $selected.Version -eq $expectedVersion -or $selected.Version.StartsWith("$expectedVersion.")
if (-not $versionMatches -and -not $AllowVersionMismatch) {
    $found = ($installations | ForEach-Object { "  $($_.Version)  $($_.Path)" }) -join [Environment]::NewLine
    throw @"
This project requires Cocos Creator $expectedVersion, but no matching installation was found.
Detected installations:
$found

Install the matching version or rerun with -AllowVersionMismatch if this is intentional.
"@
}

Write-Host "[Cocos] Creator $($selected.Version): $($selected.Path)"
Write-Host "[Cocos] Project: $projectRoot"

if ($PSCmdlet.ShouldProcess($projectRoot, "Open with Cocos Creator $($selected.Version)")) {
    $process = Start-Process `
        -FilePath $selected.Path `
        -ArgumentList @('--project', "`"$projectRoot`"") `
        -WorkingDirectory (Split-Path -Parent $selected.Path) `
        -PassThru

    Write-Host "[Cocos] Started process $($process.Id)."

    if ($Wait) {
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) {
            throw "Cocos Creator exited with code $($process.ExitCode)."
        }
    }
}
