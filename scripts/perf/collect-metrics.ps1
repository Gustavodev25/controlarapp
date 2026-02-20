param(
  [string]$PackageName = "com.gustavodev25.controlarapp",
  [string]$OutDir = "docs/performance/raw",
  [int]$DurationSec = 180,
  [int]$SampleIntervalSec = 5
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutDir $timestamp
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

Write-Host "Collecting performance metrics for package $PackageName"
Write-Host "Output folder: $runDir"

adb shell dumpsys gfxinfo $PackageName framestats > (Join-Path $runDir "gfxinfo-start.txt")
adb shell dumpsys meminfo $PackageName > (Join-Path $runDir "meminfo-start.txt")
adb shell dumpsys batterystats --charged > (Join-Path $runDir "batterystats-reset.txt")

$samplesFile = Join-Path $runDir "samples.csv"
"ts_utc,elapsed_s,cpu_top,mem_pss_kb" | Out-File -FilePath $samplesFile -Encoding utf8

for ($elapsed = 0; $elapsed -lt $DurationSec; $elapsed += $SampleIntervalSec) {
  $ts = (Get-Date).ToUniversalTime().ToString("o")
  $cpu = (adb shell top -b -n 1 -o %CPU,PID,NAME | Select-String $PackageName | Select-Object -First 1).ToString().Trim()
  $mem = (adb shell dumpsys meminfo $PackageName | Select-String "TOTAL PSS:" | Select-Object -First 1).ToString().Trim()
  "$ts,$elapsed,""$cpu"",""$mem""" | Out-File -FilePath $samplesFile -Encoding utf8 -Append
  Start-Sleep -Seconds $SampleIntervalSec
}

adb shell dumpsys gfxinfo $PackageName framestats > (Join-Path $runDir "gfxinfo-end.txt")
adb shell dumpsys meminfo $PackageName > (Join-Path $runDir "meminfo-end.txt")
adb shell dumpsys batterystats $PackageName > (Join-Path $runDir "batterystats-end.txt")

Write-Host "Done. Raw files saved in $runDir"
