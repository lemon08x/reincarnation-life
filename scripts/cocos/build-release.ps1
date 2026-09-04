[CmdletBinding()]
param(
    [ValidateSet('All', 'Web', 'Wechat')]
    [string]$Target = 'All',

    [string]$CreatorPath,

    [string]$WechatAppId = $env:WECHAT_APP_ID,

    [ValidateRange(1, 120)]
    [int]$TimeoutMinutes = 15,

    [switch]$AllowVersionMismatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$packageJsonPath = Join-Path $projectRoot 'package.json'
$buildConfigRoot = Join-Path $PSScriptRoot 'configs'
$runtimeRoot = Join-Path $projectRoot 'temp\release-build'
$logRoot = Join-Path $runtimeRoot 'logs'
$buildRoot = Join-Path $projectRoot 'build'

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
    throw "package.json was not found in project root: $projectRoot"
}

$packageJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $packageJsonPath | ConvertFrom-Json
$expectedVersion = [string]$packageJson.creator.version

if ([string]::IsNullOrWhiteSpace($expectedVersion)) {
    throw 'package.json does not declare creator.version.'
}

$includesWechat = $Target -eq 'All' -or $Target -eq 'Wechat'
if ($includesWechat -and -not [string]::IsNullOrWhiteSpace($WechatAppId)) {
    $WechatAppId = $WechatAppId.Trim()
    if ($WechatAppId -notmatch '^wx[0-9a-fA-F]{16}$') {
        throw "WechatAppId must look like 'wx' followed by 16 hexadecimal characters. Received: $WechatAppId"
    }
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

function Find-CreatorInstallation {
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

    return $selected
}

function Show-LogTail {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Write-Host "[Cocos] Last lines from $Label ($Path):"
        Get-Content -LiteralPath $Path -Encoding UTF8 -Tail 80 | ForEach-Object { Write-Host $_ }
    }
}

function Stop-CreatorHelperProcesses {
    param(
        [Parameter(Mandatory = $true)][int]$RootProcessId,
        [Parameter(Mandatory = $true)][datetime]$StartedAt
    )

    # Creator 3.8.8 can leave its command-line renderer and crash handler alive
    # after the main build process exits. Restrict cleanup to direct children
    # created by this exact invocation so an editor opened by the user is safe.
    Start-Sleep -Milliseconds 250
    try {
        $oldestAllowed = $StartedAt.AddSeconds(-2)
        $helpers = @(
            Get-CimInstance Win32_Process -Filter "ParentProcessId = $RootProcessId" -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -eq 'CocosCreator.exe' -and $_.CreationDate -ge $oldestAllowed
                }
        )

        foreach ($helper in $helpers) {
            Stop-Process -Id $helper.ProcessId -Force -ErrorAction SilentlyContinue
        }

        if ($helpers.Count -gt 0) {
            Write-Host "[Cocos] Closed $($helpers.Count) leftover helper process(es)."
        }
    } catch {
        Write-Warning "Unable to check for leftover Creator helper processes: $($_.Exception.Message)"
    }
}

function New-RuntimeBuildConfig {
    param(
        [Parameter(Mandatory = $true)][string]$Platform,
        [Parameter(Mandatory = $true)][string]$SourcePath
    )

    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        throw "Build configuration was not found: $SourcePath"
    }

    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $SourcePath | ConvertFrom-Json
    if ($Platform -eq 'wechatgame' -and -not [string]::IsNullOrWhiteSpace($WechatAppId)) {
        $config.packages.wechatgame |
            Add-Member -MemberType NoteProperty -Name 'appid' -Value $WechatAppId -Force
    }

    $runtimeConfigPath = Join-Path $runtimeRoot "$Platform.release.json"
    $json = $config | ConvertTo-Json -Depth 20
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($runtimeConfigPath, $json, $utf8WithoutBom)
    return $runtimeConfigPath
}

function Invoke-CocosBuild {
    param(
        [Parameter(Mandatory = $true)][PSCustomObject]$Creator,
        [Parameter(Mandatory = $true)][string]$Platform,
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [Parameter(Mandatory = $true)][string[]]$RequiredFiles
    )

    $outputPath = Join-Path $buildRoot $Platform
    $stdoutLog = Join-Path $logRoot "$Platform.stdout.log"
    $stderrLog = Join-Path $logRoot "$Platform.stderr.log"
    $buildStartedAt = Get-Date
    $creatorArguments = @(
        '--project', "`"$projectRoot`"",
        '--build', "`"configPath=$ConfigPath`""
    )

    Write-Host "[Cocos] Building $Platform release..."
    Write-Host "[Cocos] Output: $outputPath"

    $process = Start-Process `
        -FilePath $Creator.Path `
        -ArgumentList $creatorArguments `
        -WorkingDirectory (Split-Path -Parent $Creator.Path) `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -WindowStyle Hidden `
        -PassThru

    # Windows PowerShell 5.1 may discard ExitCode unless the native handle is
    # opened while the process is still running.
    $processHandle = $process.Handle

    $deadline = $buildStartedAt.AddMinutes($TimeoutMinutes)
    $nextStatusAt = $buildStartedAt.AddSeconds(10)

    while (-not $process.WaitForExit(500)) {
        $now = Get-Date
        if ($now -ge $nextStatusAt) {
            $elapsed = [Math]::Floor(($now - $buildStartedAt).TotalSeconds)
            Write-Host "[Cocos] $Platform is still building (${elapsed}s)..."
            $nextStatusAt = $now.AddSeconds(10)
        }

        if ($now -ge $deadline) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            $process.WaitForExit(5000) | Out-Null
            Stop-CreatorHelperProcesses -RootProcessId $process.Id -StartedAt $buildStartedAt
            throw "Cocos Creator timed out while building $Platform after $TimeoutMinutes minute(s). Logs: $stdoutLog"
        }
    }

    # The parameterless wait flushes redirected streams before reading the exit code.
    $process.WaitForExit()
    $process.Refresh()
    $exitCode = $process.ExitCode
    Stop-CreatorHelperProcesses -RootProcessId $process.Id -StartedAt $buildStartedAt
    $successfulExitCodes = @(0, 36)
    if ($exitCode -notin $successfulExitCodes) {
        Show-LogTail -Label 'standard output' -Path $stdoutLog
        Show-LogTail -Label 'standard error' -Path $stderrLog
        throw "Cocos Creator failed to build $Platform (exit code $exitCode)."
    }

    $missingFiles = @(
        $RequiredFiles | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $outputPath $_) -PathType Leaf)
        }
    )
    if ($missingFiles.Count -gt 0) {
        Show-LogTail -Label 'standard output' -Path $stdoutLog
        throw "Cocos Creator reported success, but $Platform output is incomplete. Missing: $($missingFiles -join ', ')"
    }

    $staleFiles = @(
        $RequiredFiles | Where-Object {
            (Get-Item -LiteralPath (Join-Path $outputPath $_)).LastWriteTime -lt $buildStartedAt.AddSeconds(-2)
        }
    )
    if ($staleFiles.Count -gt 0) {
        throw "The $Platform output was not refreshed by this build. Stale files: $($staleFiles -join ', ')"
    }

    $outputBytes = (Get-ChildItem -Recurse -File -LiteralPath $outputPath |
        Measure-Object -Property Length -Sum).Sum
    $outputMiB = [Math]::Round($outputBytes / 1MB, 2)
    $elapsedSeconds = [Math]::Round(((Get-Date) - $buildStartedAt).TotalSeconds, 1)
    Write-Host "[Cocos] $Platform release ready ($outputMiB MiB, ${elapsedSeconds}s)."
    Write-Host "[Cocos] Logs: $stdoutLog"
}

$creator = Find-CreatorInstallation
Write-Host "[Release] Creator $($creator.Version): $($creator.Path)"
Write-Host "[Release] Project: $projectRoot"

$npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $npmCommand) {
    throw 'npm.cmd was not found. Install Node.js and run npm install before building.'
}

Write-Host '[Release] Running TypeScript verification...'
& $npmCommand.Source run typecheck
if ($LASTEXITCODE -ne 0) {
    throw "TypeScript verification failed with exit code $LASTEXITCODE."
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

$builds = switch ($Target) {
    'Web' {
        @([PSCustomObject]@{
            Platform = 'web-mobile'
            Config = 'web-mobile.release.json'
            RequiredFiles = @('index.html')
        })
    }
    'Wechat' {
        @([PSCustomObject]@{
            Platform = 'wechatgame'
            Config = 'wechatgame.release.json'
            RequiredFiles = @('game.js', 'game.json', 'project.config.json')
        })
    }
    default {
        @(
            [PSCustomObject]@{
                Platform = 'web-mobile'
                Config = 'web-mobile.release.json'
                RequiredFiles = @('index.html')
            },
            [PSCustomObject]@{
                Platform = 'wechatgame'
                Config = 'wechatgame.release.json'
                RequiredFiles = @('game.js', 'game.json', 'project.config.json')
            }
        )
    }
}

foreach ($build in $builds) {
    $sourceConfigPath = Join-Path $buildConfigRoot $build.Config
    $runtimeConfigPath = New-RuntimeBuildConfig -Platform $build.Platform -SourcePath $sourceConfigPath
    Invoke-CocosBuild `
        -Creator $creator `
        -Platform $build.Platform `
        -ConfigPath $runtimeConfigPath `
        -RequiredFiles $build.RequiredFiles
}

if ($builds.Platform -contains 'wechatgame') {
    if ([string]::IsNullOrWhiteSpace($WechatAppId)) {
        Write-Warning 'No WeChat AppID was supplied. The generated project is suitable for local inspection, but not official preview/upload.'
    } else {
        $wechatProjectConfigPath = Join-Path $buildRoot 'wechatgame\project.config.json'
        $wechatProjectConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath $wechatProjectConfigPath | ConvertFrom-Json
        if ([string]$wechatProjectConfig.appid -ne $WechatAppId) {
            throw "The WeChat output did not preserve the requested AppID. Expected $WechatAppId, received $($wechatProjectConfig.appid)."
        }
        Write-Host "[WeChat] AppID embedded in project configuration: $WechatAppId"
    }
}

Write-Host '[Release] Build artifacts were generated locally only; nothing was uploaded or published.'
