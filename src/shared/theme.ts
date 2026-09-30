/**
 * Design system — "Railway Signal".
 *
 * Two themes:
 *   ledger     — warm off-white paper, deep ink text (default in daylight)
 *   nightShift — deep ink surfaces for godown / late-night use
 *
 * Rules (docs/UI_UX_DIRECTION.md):
 *   - ONE accent colour, and it is the tenant's own brand colour
 *     (BusinessProfile.brandColor). Every agency's app looks like theirs.
 *   - green / amber / red are reserved for STATUS only — never decoration.
 *   - money, codes, bilti numbers and the departure board use a monospace face
 *     with tabular figures so columns of rupees line up.
 *   - touch targets ≥ 44 px.
 *
 * Screens read tokens through useTheme() (see useTheme.ts), never hard-code colours.
 */

export type ThemeMode = "light" | "dark";

export interface Colors {
  bg: string; // app background
  surface: string; // cards, sheets
  surfaceAlt: string; // table header, subtle fills
  surfaceSunken: string; // inputs
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string; // tenant brand colour
  accentText: string; // text on accent
  accentSoft: string; // tinted background
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  // Departure board
  board: string;
  boardCell: string;
  boardText: string; // amber LED
  boardDim: string;
}

const DEFAULT_ACCENT = "#3346D3";

/** Mix a hex colour with another (t = 0..1 towards `to`). */
export function mix(hex: string, to: string, t: number): string {
  const p = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    const n = parseInt(m ? m[1] : "000000", 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = p(hex);
  const b = p(to);
  return `#${a
    .map((v, i) =>
      Math.round(v + (b[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Relative luminance → pick readable text on a coloured background. */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m ? m[1] : "000000", 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#14161A" : "#FFFFFF";
}

export function buildColors(
  mode: ThemeMode,
  accentHex?: string | null,
): Colors {
  const accent = /^#[0-9a-f]{6}$/i.test(accentHex || "")
    ? (accentHex as string)
    : DEFAULT_ACCENT;
  if (mode === "dark") {
    const a = mix(accent, "#FFFFFF", 0.25); // lift the accent on dark
    return {
      bg: "#0E1116",
      surface: "#161A21",
      surfaceAlt: "#1C212A",
      surfaceSunken: "#11151B",
      border: "#262C36",
      borderStrong: "#39414E",
      text: "#E8EAED",
      textMuted: "#A2A9B4",
      textFaint: "#6B7380",
      accent: a,
      accentText: readableOn(a),
      accentSoft: mix(a, "#0E1116", 0.8),
      success: "#34C77B",
      successSoft: "#12281D",
      warning: "#F2B33D",
      warningSoft: "#2E2410",
      danger: "#F0605D",
      dangerSoft: "#2E1616",
      info: "#5AA9F2",
      infoSoft: "#122232",
      overlay: "rgba(0,0,0,0.6)",
      board: "#07090C",
      boardCell: "#12161C",
      boardText: "#FFC940",
      boardDim: "#6B5A2A",
    };
  }
  return {
    bg: "#F6F4EF",
    surface: "#FFFFFF",
    surfaceAlt: "#F1EEE7",
    surfaceSunken: "#FBFAF7",
    border: "#E4DFD4",
    borderStrong: "#CFC8BA",
    text: "#14161A",
    textMuted: "#5B6170",
    textFaint: "#8F95A1",
    accent,
    accentText: readableOn(accent),
    accentSoft: mix(accent, "#FFFFFF", 0.9),
    success: "#15803D",
    successSoft: "#E6F4EA",
    warning: "#B45309",
    warningSoft: "#FDF1DC",
    danger: "#C62828",
    dangerSoft: "#FCE8E6",
    info: "#1D5FB8",
    infoSoft: "#E4EEFB",
    overlay: "rgba(20,22,26,0.45)",
    board: "#111317",
    boardCell: "#1B1E24",
    boardText: "#FFC940",
    boardDim: "#6B5A2A",
  };
}

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const type = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.semibold,
    letterSpacing: -0.6,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.semibold,
    letterSpacing: -0.3,
  },
  h2: { fontSize: 19, lineHeight: 26, fontFamily: fonts.semibold },
  h3: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.medium },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.regular },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: fonts.mono },
  money: { fontSize: 15, lineHeight: 22, fontFamily: fonts.mono },
} as const;

export type TypeVariant = keyof typeof type;

/** Layout breakpoints (window width). */
export const breakpoints = { tablet: 768, desktop: 1100 } as const;

/** Status → colour key. One vocabulary for every status pill in the app. */
export const STATUS_TONE: Record<
  string,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  // delivery lifecycle
  received: "info",
  loaded: "info",
  in_transit: "warning",
  unloaded: "warning",
  delivered: "success",
  returned: "danger",
  // payment
  pending: "warning",
  partial: "warning",
  settled: "success",
  // invoice
  draft: "neutral",
  sent: "info",
  paid: "success",
  cancelled: "danger",
  // org / subscription
  active: "success",
  trial: "info",
  past_due: "warning",
  suspended: "danger",
  rejected: "danger",
  approved: "success",
  expired: "danger",
  grace: "warning",
  ok: "success",
  // activity log
  denied: "danger",
};
