import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, Check } from "lucide-react";

export function PwaInstallButton() {
  const { canInstall, isInstalled, install } = usePwaInstall();

  if (isInstalled) {
    return (
      <button
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-green-400 border border-green-400/30 bg-green-400/5 cursor-default"
        disabled
      >
        <Check className="w-3.5 h-3.5" />
        Installed
      </button>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <button
      onClick={install}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-cyan-400 border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/15 hover:border-cyan-400/60 transition-all duration-200 cursor-pointer"
    >
      <Download className="w-3.5 h-3.5" />
      Install App
    </button>
  );
}
