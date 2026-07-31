import { useState, useEffect } from "react";

type ThemeMode = "light" | "dark" | "system";

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  const effective = getEffectiveTheme(mode);
  document.documentElement.setAttribute("data-theme", effective);
  localStorage.setItem("theme", mode === "system" ? "system" : effective);
  if (mode === "system") {
    localStorage.setItem("theme-mode", "system");
  } else {
    localStorage.setItem("theme-mode", mode);
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme-mode") as ThemeMode | null;
    if (saved && ["light", "dark", "system"].includes(saved)) {
      setMode(saved);
    }
  }, []);

  useEffect(() => {
    applyTheme(mode);

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const handleChange = (newMode: ThemeMode) => {
    setMode(newMode);
    applyTheme(newMode);
  };

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "ライトモード", icon: <SunIcon /> },
    { value: "dark", label: "ダークモード", icon: <MoonIcon /> },
    { value: "system", label: "システム設定に合わせる", icon: <MonitorIcon /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="テーマ切り替え"
      className="inline-flex items-center gap-1 rounded-sm border border-border-default bg-surface-soft p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={mode === opt.value}
          aria-label={opt.label}
          title={opt.label}
          onClick={() => handleChange(opt.value)}
          className={`
            inline-flex items-center justify-center rounded-[6px] p-2
            min-w-[44px] min-h-[44px]
            transition-colors duration-200
            ${mode === opt.value
              ? "bg-surface-elevated text-accent-blue shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-medium"
            }
          `}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
