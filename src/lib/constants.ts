export const COLORS = {
  primary: "#4F46E5",
  secondary: "#7C3AED",
  accent: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  background: "#F9FAFB",
  foreground: "#111827",
} as const;

export const CONFIG = {
  appName: "Bravocademy",
  examTimeoutSeconds: 60 * 90, // 90 minutes default
} as const;
