param(
  [string]$PackageName = "com.gustavodev25.controlarapp",
  [ValidateSet("cold_start", "dashboard_3min", "transactions_scroll_5min", "invoice_flow_5min", "tab_switch_bg_fg")]
  [string]$Scenario = "cold_start"
)

Write-Host "Running scenario: $Scenario"

switch ($Scenario) {
  "cold_start" {
    adb shell am force-stop $PackageName
    Start-Sleep -Milliseconds 600
    adb shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1
    Write-Host "Cold start launched. Wait for dashboard ready state."
  }
  "dashboard_3min" {
    Write-Host "Manual flow: interact with dashboard cards/charts for 3 minutes."
  }
  "transactions_scroll_5min" {
    Write-Host "Manual flow: open transactions and run continuous scroll for 5 minutes."
  }
  "invoice_flow_5min" {
    Write-Host "Manual flow: open invoices, switch cards, apply filters, expand rows for 5 minutes."
  }
  "tab_switch_bg_fg" {
    Write-Host "Manual flow: switch tabs repeatedly and send app background/foreground for 2-3 minutes."
  }
}

Write-Host "Tip: run collect-metrics.ps1 in parallel while executing this scenario."
