# DynWallpaper

> 基于 Electron + React + TypeScript 的 Windows 动态壁纸管理工具

## 📌 项目状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| 静态壁纸设置 | ✅ 完成 | 支持 JPG/PNG/BMP/WebP，自动转 BMP |
| 动态壁纸（视频） | ✅ 完成 | WorkerW + mpv，循环播放，无声处理 |
| 壁纸库管理 | ✅ 完成 | 导入/预览/删除，缩略图生成 |
| 壁纸库搜索/筛选/排序 | ✅ 完成 | 支持关键词搜索、分辨率筛选、多种排序方式 |
| 壁纸库批量操作 | ✅ 完成 | 批量选择、批量删除 |
| 壁纸分辨率/宽高比标签 | ✅ 完成 | 自动识别并显示分辨率等级和宽高比 |
| 可配置壁纸存储目录 | ✅ 完成 | 支持自定义壁纸存储路径，避免数据丢失 |
| 新拟态 UI 设计 | ✅ 完成 | 统一的明暗主题，新拟态风格组件 |
| 全局 Toast 提示 | ✅ 完成 | 替代原生 alert，符合设计风格 |
| 系统托盘 | ✅ 完成 | 关闭按钮隐藏窗口，托盘菜单 |
| 开机自启 | ✅ 完成 | 注册表 `HKCU\...\Run` |
| 依赖检测与安装 | ✅ 完成 | winget 一键安装 mpv/ffmpeg，结果持久化 |
| 壁纸编辑（裁剪） | ✅ 完成 | 支持自由裁剪、比例裁剪、显示器比例识别 |
| 多显示器支持 | ⏳ 待开发 | — |
| 应用图标 | ⚠️ 临时 | 使用 proton-native.ico 占位，无正式图标 |
| 打包构建 | ⏳ 待验证 | 尚未执行 `npm run dist` 验证打包效果 |

---

## 🗂️ 项目结构

```
WinDynWallpaper/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口：窗口/托盘/IPC/开机自启
│   │   ├── wallpaper-manager.ts # 壁纸设置核心逻辑
│   │   ├── store-manager.ts     # 壁纸库存储 + 缩略图生成 + 尺寸获取
│   │   └── utils.ts             # ffmpeg/mpv 路径查找（共享）
│   ├── preload/
│   │   └── index.ts             # contextBridge API 暴露
│   ├── renderer/                # React 渲染进程
│   │   ├── App.tsx              # 路由配置 + 主题初始化 + Toast 挂载
│   │   ├── global.d.ts          # window.electronAPI 类型声明
│   │   ├── components/
│   │   │   ├── Layout.tsx       # 侧边栏布局
│   │   │   ├── Toast.tsx        # 全局提示组件
│   │   │   └── ConfirmDialog.tsx # 自定义确认框
│   │   ├── pages/
│   │   │   ├── HomePage.tsx           # 首页（快捷设置）
│   │   │   ├── LibraryPage.tsx        # 壁纸库（搜索/筛选/排序/批量操作）
│   │   │   ├── WallpaperDetailPage.tsx # 壁纸详情
│   │   │   ├── WallpaperEditPage.tsx   # 壁纸编辑（裁剪）
│   │   │   └── SettingsPage.tsx       # 设置（自启 + 依赖管理 + 主题切换）
│   │   └── styles/
│   │       └── index.css        # 全局样式（新拟态 + 明暗主题）
│   └── global.d.ts              # 根级类型声明
├── resources/
│   └── icon.ico                 # 应用图标（proton-native.ico 占位）
├── dist/                        # electron-vite 构建输出
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
└── README.md
```

**注：** `src/shared/` 目录已废弃，共享类型声明在根级 `src/global.d.ts`。

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Windows 10/11
- mpv（动态壁纸必需，ffmpeg 可选用于视频缩略图）

### 安装依赖

```bash
cd D:\Project\WinDynWallpaper
npm install
```

### 安装外部依赖（mpv）

**方式一：winget（推荐）**
```bash
winget install --id MPV.MPV --accept-source-agreements --accept-package-agreements
winget install --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
```

**方式二：手动放置**
将 mpv.exe 放入 `bin/mpv/mpv.exe`，ffmpeg.exe 放入 `bin/ffmpeg/ffmpeg.exe`。

### 开发模式

```bash
npm run dev
```

### 构建打包

```bash
npm run build     # 构建
npm run dist      # 打包安装程序
```

---

## 🔧 核心功能说明

### 1. 静态壁纸

调用 Windows API `SystemParametersInfo(SPI_SETDESKWALLPAPER)`，自动将图片转换为 BMP 格式。

支持的格式：JPG / JPEG / PNG / BMP / WebP

### 2. 动态壁纸（WorkerW + mpv）

原理：

```
Windows 桌面层次
  Progman (窗口 65832)
    ├── SHELLDLL_DefView (65840)  ← 图标层
    └── WorkerW (6293802)          ← 壁纸层（mpv 嵌入位置）
```

实现步骤：
1. 通过 PowerShell + C# P/Invoke 枚举 Progman 子窗口，找到 WorkerW
2. 用 `mpv --wid=<hwnd>` 将视频嵌入该 WorkerW
3. `--loop-file=inf` 循环播放，`--no-media-controls` 禁用 Windows 媒体控制

**无声视频处理：** 如果视频有音轨，用 ffmpeg 提取纯视频轨道存入 `%APPDATA%/win-dyn-wallpaper/silent_<hash>.mp4`，避免 Windows 音量混合器出现 mpv。

### 3. 壁纸编辑

支持对壁纸进行裁剪编辑：
- **自由裁剪**：任意拖拽选择裁剪区域
- **比例裁剪**：预设比例（1:1、16:9、9:16、4:3、3:4、21:9、9:21）或自定义比例
- **显示器推荐**：自动识别连接的显示器分辨率，一键应用对应比例
- **交互体验**：
  - 鼠标在图片上时隐藏提示气泡
  - 半透明遮罩显示未选中区域
  - 四角手柄支持调整选区大小
  - 支持拖拽移动选区

技术实现：
- 前端：Canvas API 绘制图片和选区，ResizeObserver 自适应容器
- 后端：PowerShell + System.Drawing 执行裁剪，保持原始图片质量

### 4. 壁纸库

存储在可配置目录（默认 `%APPDATA%/dyn-wallpaper/wallpapers/`）：
- `wallpapers/` — 原始文件副本（SHA256 ID 命名）
- `thumbnails/` — 缩略图（JPG 320px）
- `index.json` — 壁纸索引

缩略图生成：
- 静态：GDI+ System.Drawing.Image 缩放
- 动态：ffmpeg `-ss 0.5 -vframes 1` 或 mpv `--vo=image`

分辨率/宽高比标签：
- 分辨率等级：<1K（<1920px）/1K（1920-2559px）/2K（2560-3839px）/4K（3840-7679px）/8K（7680-8191px）/>8K（≥8192px）
- 宽高比：直接显示 `宽×高` 格式（如 3072×4096）

壁纸库功能：
- 搜索：关键词搜索壁纸名称
- 筛选：按分辨率等级筛选
- 排序：按添加时间、名称、文件大小、分辨率排序
- 批量操作：批量选择、批量删除
- 分页：每页显示 8 张壁纸

### 5. 系统托盘

- 点击关闭按钮 → 隐藏窗口（不退出），最小化到托盘
- 托盘右键菜单：显示主面板 / 退出
- 双击托盘图标：显示窗口

### 6. 开机自启

通过注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 实现。
- 开发模式：注册 `electron.exe` 路径
- 生产模式：注册打包后的 exe 路径

### 7. 依赖检测

检测 mpv 和 ffmpeg 是否安装，显示路径和版本。
- 结果缓存在 `localStorage`（`windyn_deps_last_check`），进入设置页不自动重新检查
- 点击"刷新状态"手动重新检测
- 一键安装通过 winget 完成

---

## 🐛 已知问题

1. **应用图标**：使用 `proton-native.ico` 占位，需设计并替换正式图标
2. **中文路径**：壁纸文件路径含中文时，PowerShell 脚本中的字符串拼接可能有编码问题（未完整验证）
3. **多显示器**：只支持主显示器，WorkerW 窗口查找逻辑未考虑多屏场景
4. **getPerfStats 未清理**：`src/global.d.ts` 中仍保留 `getPerfStats` 类型声明，但 preload 和 IPC handler 已移除，存在类型不一致
5. **打包验证**：未执行 `npm run dist` 验证打包后 exe 是否正常运行
6. **旧数据迁移**：应用改名后数据目录切换，旧壁纸数据未自动迁移，需手动复制

---

## 📋 待办事项（按优先级）

### 高优先级
- [ ] **正式应用图标**：设计并替换 `resources/icon.ico`
- [ ] **打包验证**：执行 `npm run dist`，测试安装包在干净环境运行
- [x] **修复 `getPerfStats` 类型残留**：删除 `global.d.ts` 中的 `PerfStats` 相关类型声明
- [ ] **旧数据自动迁移**：应用改名后自动检测并迁移旧壁纸数据

### 中优先级
- [ ] **多显示器支持**：WorkerW 窗口枚举时按屏幕坐标筛选
- [ ] **中文路径验证**：完整测试含中文字符的壁纸文件路径
- [x] **开机自启优化**：开发模式注册的是 `electron.exe`，可能影响实际使用体验（已添加开发模式提示）
- [x] **壁纸库分页功能**：每页显示 12 张壁纸，支持翻页

### 低优先级
- [ ] 定时自动切换壁纸
- [ ] 壁纸分类标签
- [x] 移除未使用的依赖（`@electron/remote`、`ffmpeg-static`）

---

## 📡 IPC API 一览

| IPC 通道 | 方向 | 说明 |
|----------|------|------|
| `wallpaper:set-static` | renderer→main | 设置静态壁纸 |
| `wallpaper:set-dynamic` | renderer→main | 设置动态壁纸 |
| `wallpaper:stop-dynamic` | renderer→main | 停止动态壁纸 |
| `wallpaper:restore-default` | renderer→main | 恢复系统默认壁纸 |
| `wallpaper:get-current` | renderer→main | 获取当前壁纸信息 |
| `store:add-wallpaper` | renderer→main | 添加壁纸到库 |
| `store:remove-wallpaper` | renderer→main | 从壁纸库删除 |
| `store:get-wallpapers` | renderer→main | 获取壁纸列表 |
| `store:get-wallpaper-dir` | renderer→main | 获取壁纸存储目录 |
| `store:set-wallpaper-dir` | renderer→main | 设置壁纸存储目录 |
| `store:select-wallpaper-dir` | renderer→main | 选择壁纸存储目录对话框 |
| `store:scan-storage-dir` | renderer→main | 扫描目录导入壁纸 |
| `store:get-wallpaper-by-id` | renderer→main | 根据 ID 获取壁纸详情 |
| `wallpaper:crop` | renderer→main | 裁剪壁纸 |
| `system:get-displays` | renderer→main | 获取显示器信息 |
| `dialog:open-file` | renderer→main | 打开文件选择对话框 |
| `window:minimize` | renderer→main | 最小化窗口 |
| `window:maximize` | renderer→main | 最大化/还原窗口 |
| `window:close` | renderer→main | 关闭窗口（隐藏到托盘） |
| `auto-launch:get` | renderer→main | 获取开机自启状态 |
| `auto-launch:set` | renderer→main | 设置开机自启 |
| `deps:check` | renderer→main | 检查依赖 |
| `deps:install` | renderer→main | 安装依赖 |
| `deps:uninstall` | renderer→main | 卸载依赖 |
| `deps:repair` | renderer→main | 修复依赖 |

---

## 📝 更新日志

### v0.2.1 (2026-04-20)

**新增：**
- 壁纸编辑功能：支持自由裁剪、比例裁剪、显示器比例识别
- 壁纸编辑页：新拟态风格设计，左侧比例选择，右侧画布交互
- 显示器比例识别：自动获取连接的显示器分辨率，一键应用对应比例
- 壁纸库分页：每页显示 12 张壁纸（原为 8 张）
- 壁纸详情页：新增编辑入口，优化布局和圆角样式

**优化：**
- 壁纸库页面：固定头部，内容区域独立滚动
- 壁纸详情页：顶部和图片区域增加白色背景和圆角
- 编辑页交互：修改自定义比例数字立即生效，无需点击按钮
- 编辑页视觉：拖拽时隐藏气泡提示，半透明遮罩显示选区

### v0.2.0 (2026-04-17)

**新增：**
- 新拟态 UI 设计：统一的明暗主题，新拟态风格组件
- 全局 Toast 提示：替代原生 alert，符合设计风格
- 自定义确认框：新拟态风格，替代原生 confirm
- 壁纸库搜索/筛选/排序：支持关键词搜索、分辨率筛选、多种排序方式
- 壁纸库批量操作：批量选择、批量删除
- 壁纸分辨率/宽高比标签：自动识别并显示分辨率等级和宽高比
- 可配置壁纸存储目录：支持自定义壁纸存储路径，避免数据丢失

**优化：**
- 应用改名：WinDynWallpaper → DynWallpaper
- 窗口尺寸：默认和最小尺寸均为 1200×800
- 侧边栏布局：简化 HomePage，优化 SettingsPage 分区结构
- 依赖检查区域：优化按钮布局，文案修改
- 壁纸库分页：每页显示 12 张，调整间距消除滚动条

**修复：**
- 分辨率枚举值：从 SD/HD/1K/2K/4K/8K 改为 <1K/1K/2K/4K/8K/>8K
- 选择逻辑：修复切换选择范围时需要点击两次的问题
- 确认按钮样式：修复 border-radius 变量错误
- electron-vite dev 报告 exit code 1：识别为进程监视机制特性，非实际错误
- 多 GPU 环境：添加 disableHardwareAcceleration
- 托盘图标：使用 nativeImage.createFromDataURL() 修复桌面环境兼容性

**移除：**
- 自定义标题栏：改用系统原生窗口边框
- Tailwind CSS：移除依赖，使用纯 CSS 实现新拟态风格

### v0.1.1 (2026-04-17)

**修复：**
- FFmpeg 检测逻辑与运行时不一致（两套独立代码）→ 统一使用 `utils.ts` 的共享函数
- 菜单切换卡顿（`<img>` 每次渲染重新加载 `file://` URL）→ 添加缓存 key + lazy loading
- mpv 进程误杀（`taskkill` 杀掉所有 mpv 实例）→ 精确跟踪自身 PID，只杀自己
- 无声视频缓存冲突（固定文件名导致不同视频互相覆盖）→ MD5 hash 命名
- mpv 被 Windows 识别为媒体播放器（音量混合器出现 mpv）→ `--no-media-controls` + ffmpeg 提取纯视频轨道

**新增：**
- 系统托盘（最小化到托盘，托盘菜单）
- 开机自启（注册表方式）
- 依赖检测与一键安装（winget + 结果持久化）
- 壁纸库图片加载优化（缓存 + lazy）
- `src/main/utils.ts`（ffmpeg/mpv 路径共享查找）

**移除：**
### v0.1.0 (2026-04-16)

- 项目初始化（Electron + React + TypeScript + electron-vite）
- 静态壁纸设置功能
- 壁纸库存储与管理
- 恢复默认壁纸
- 基础用户界面

---

## 🤝 贡献指南

本项目由个人开发，欢迎 Issue 和 Pull Request。

## 📄 许可证

MIT License
