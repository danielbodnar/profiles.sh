export const PERSONA_COLORS: Record<
  string,
  { accent: string; bg: [string, string] }
> = {
  systems: { accent: "#4A90D9", bg: ["#0a1628", "#132744"] },
  platform: { accent: "#7C4DFF", bg: ["#1a0a2e", "#2d1b4e"] },
  software: { accent: "#00E676", bg: ["#0a1a0f", "#132e1a"] },
  cloud: { accent: "#40C4FF", bg: ["#071825", "#0d2b45"] },
  linux: { accent: "#FFEB3B", bg: ["#1a1800", "#2e2a05"] },
  solutions: { accent: "#FF9800", bg: ["#1a1005", "#2e1f0a"] },
  sre: { accent: "#FF5252", bg: ["#1a0505", "#2e0f0f"] },
  dad: { accent: "#F48FB1", bg: ["#1a0f15", "#2e1a28"] },
  tinkerer: { accent: "#FFD54F", bg: ["#1a1508", "#2e2510"] },
  hacker: { accent: "#00FF41", bg: ["#000000", "#0a0a0a"] },
};

export const RADAR_LABELS: Record<string, { label: string; color: string }> = {
  systems: { label: "Rust/Systems", color: PERSONA_COLORS.systems.accent },
  platform: { label: "Platform/IaC", color: PERSONA_COLORS.platform.accent },
  software: { label: "TypeScript/JS", color: PERSONA_COLORS.software.accent },
  cloud: { label: "Cloud/Infra", color: PERSONA_COLORS.cloud.accent },
  linux: { label: "Linux/Desktop", color: PERSONA_COLORS.linux.accent },
  solutions: { label: "Solutions", color: PERSONA_COLORS.solutions.accent },
  sre: { label: "Security", color: PERSONA_COLORS.sre.accent },
  tinkerer: { label: "AI/LLM", color: PERSONA_COLORS.tinkerer.accent },
  hacker: { label: "Neovim/Editor", color: PERSONA_COLORS.hacker.accent },
};
