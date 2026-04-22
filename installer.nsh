!macro customInstall
  ; 安装前检测：若应用已启动，强制关闭后继续安装
  DetailPrint "检查 DynWallpaper 是否正在运行..."
  ExecWait 'taskkill /F /IM DynWallpaper.exe'
  Sleep 1500
  DetailPrint "已关闭旧版进程，开始安装..."
!macroend

!macro customInstallOnInit
  ; 此处代码会被注入到安装初始化区段
!macroend