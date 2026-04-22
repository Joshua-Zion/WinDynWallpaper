using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class GetWorkerW
{
    [DllImport("user32.dll")]
    static extern IntPtr GetShellWindow();

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string windowName);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder buf, int maxCount);

    [DllImport("user32.dll")]
    static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    const uint WM_SPAWN_WORKERW = 0x052C;
    const int MAX_CLASSNAME = 256;

    /// <summary>
    /// 在指定父窗口的所有直接子窗口中，查找指定类名的窗口句柄。
    /// </summary>
    static IntPtr FindChildByClass(IntPtr parent, string className)
    {
        IntPtr child = IntPtr.Zero;
        StringBuilder sb = new StringBuilder(MAX_CLASSNAME);
        while (true)
        {
            child = FindWindowEx(parent, child, null, null);
            if (child == IntPtr.Zero) break;
            sb.Clear();
            int len = GetClassName(child, sb, MAX_CLASSNAME);
            if (len > 0 && sb.ToString(0, len) == className)
            {
                return child;
            }
        }
        return IntPtr.Zero;
    }

    /// <summary>
    /// 触发桌面创建 WorkerW 壁纸层。
    /// 流程：0x052C 消息 → 枚举 Progman 直接子窗口 → 找到壁纸层 WorkerW
    /// 壁纸层特征：该 WorkerW 不包含 SHELLDLL_DefView 子窗口
    /// </summary>
    public static int Main(string[] args)
    {
        // 1. 获取 Progman（桌面窗口管理器）句柄
        IntPtr progman = GetShellWindow();
        if (progman == IntPtr.Zero)
        {
            Console.Error.WriteLine("ERROR:GetShellWindow");
            return 1;
        }

        // 2. 触发 WorkerW 创建
        SendMessage(progman, WM_SPAWN_WORKERW, IntPtr.Zero, IntPtr.Zero);
        Thread.Sleep(400);

        // 3. 枚举 Progman 的直接子窗口，找到壁纸层 WorkerW
        //    壁纸层 WorkerW：不包含 SHELLDLL_DefView 子窗口
        //    图标层 WorkerW：包含 SHELLDLL_DefView（桌面图标在此窗口上绘制）
        IntPtr candidate = IntPtr.Zero;
        StringBuilder sb = new StringBuilder(MAX_CLASSNAME);

        while (true)
        {
            candidate = FindWindowEx(progman, candidate, null, null);
            if (candidate == IntPtr.Zero) break;

            sb.Clear();
            int len = GetClassName(candidate, sb, MAX_CLASSNAME);
            if (len <= 0) continue;
            string cls = sb.ToString(0, len);

            if (cls == "WorkerW" && IsWindowVisible(candidate))
            {
                // 检查该 WorkerW 是否包含 SHELLDLL_DefView 子窗口
                // 如果包含 → 图标层，跳过
                // 如果不包含 → 壁纸层，即为目标
                IntPtr shellDefView = FindWindowEx(candidate, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (shellDefView == IntPtr.Zero)
                {
                    // 不包含 SHELLDLL_DefView → 壁纸层
                    Console.WriteLine(candidate.ToInt64());
                    return 0;
                }
                // 包含 SHELLDLL_DefView → 图标层，继续找下一个
            }
        }

        Console.Error.WriteLine("ERROR:WorkerW not found");
        return 1;
    }
}
