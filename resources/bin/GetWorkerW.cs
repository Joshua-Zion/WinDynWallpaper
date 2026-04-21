using System;
using System.Runtime.InteropServices;
using System.Text;

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

    public static int Main(string[] args)
    {
        IntPtr progman = GetShellWindow();
        if (progman == IntPtr.Zero)
        {
            Console.Error.WriteLine("ERROR:Progman");
            return 1;
        }

        SendMessage(progman, 0x052C, IntPtr.Zero, IntPtr.Zero);
        System.Threading.Thread.Sleep(300);

        StringBuilder sb = new StringBuilder(256);
        IntPtr child = IntPtr.Zero;
        IntPtr workerW = IntPtr.Zero;

        while (true)
        {
            child = FindWindowEx(progman, child, null, null);
            if (child == IntPtr.Zero) break;

            GetClassName(child, sb, 256);
            string cls = sb.ToString();

            if (cls == "WorkerW" && IsWindowVisible(child))
            {
                workerW = child;
                break;
            }
        }

        if (workerW == IntPtr.Zero)
        {
            Console.Error.WriteLine("ERROR:WorkerW");
            return 1;
        }

        Console.WriteLine(workerW.ToInt64());
        return 0;
    }
}