$ErrorActionPreference = "Continue"
$exePath = "D:\Projects\WinDynWallpaper\resources\bin\GetWorkerW.exe"
$mpvPath = "D:\Projects\WinDynWallpaper\bin\mpv\mpv.exe"
$videoPath = "D:\Projects\WinDynWallpaper\resources\samples\sample.mp4"

Write-Host "=== DynWallpaper 诊断测试 ===" -ForegroundColor Cyan

# 1. 测试 GetWorkerW.exe
Write-Host "`n[1] GetWorkerW.exe 测试..." -ForegroundColor Yellow
if (Test-Path $exePath) {
    $hwnd = & $exePath 2>&1
    Write-Host "  GetWorkerW.exe 返回: $hwnd" -ForegroundColor Green
} else {
    Write-Host "  ERROR: GetWorkerW.exe 不存在!" -ForegroundColor Red
    exit 1
}

# 2. 检查 mpv
Write-Host "`n[2] mpv.exe 检查..." -ForegroundColor Yellow
if (Test-Path $mpvPath) {
    $mpvSize = [Math]::Round((Get-Item $mpvPath).Length / 1MB, 1)
    Write-Host "  mpv.exe 存在 ($mpvSize MB)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: mpv.exe 不存在!" -ForegroundColor Red
    exit 1
}

# 3. 检查测试视频
Write-Host "`n[3] 测试视频检查..." -ForegroundColor Yellow
if (Test-Path $videoPath) {
    $vSize = [Math]::Round((Get-Item $videoPath).Length / 1MB, 1)
    Write-Host "  视频存在: $videoPath ($vSize MB)" -ForegroundColor Green
} else {
    Write-Host "  WARNING: 测试视频不存在，跳过播放测试" -ForegroundColor Magenta
    Write-Host "  请手动选择一个视频测试" -ForegroundColor Magenta
    $videoPath = $null
}

# 4. 用 PowerShell 直接测试 mpv --wid 嵌入
if ($videoPath) {
    Write-Host "`n[4] mpv --wid=$hwnd 嵌入测试..." -ForegroundColor Yellow
    Write-Host "  启动 mpv，5秒后自动退出..." -ForegroundColor Gray
    $proc = Start-Process $mpvPath -ArgumentList "--wid=$hwnd","--loop-file=inf","--no-osc","--no-osd-bar","--panscan=1.0","--keep-open=yes","--really-quiet","--msg-level=all=no",$videoPath -PassThru -WindowStyle Hidden
    Start-Sleep 5
    if (-not $proc.HasExited) {
        Write-Host "  SUCCESS: mpv 正在运行 (PID=$($proc.Id))" -ForegroundColor Green
        Stop-Process $proc.Id -Force -EA SilentlyContinue
        Write-Host "  已停止 mpv" -ForegroundColor Gray
    } else {
        Write-Host "  FAILED: mpv 已退出，退出码=$($proc.ExitCode)" -ForegroundColor Red
    }
} else {
    Write-Host "`n[4] mpv --wid 嵌入测试: 跳过（无测试视频）" -ForegroundColor Gray
}

Write-Host "`n=== 诊断完成 ===" -ForegroundColor Cyan
