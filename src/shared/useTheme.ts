import { useMemo } from "react";
import { useColorScheme, useWindowDimensions } from "react-native";
import { useThemeStore } from "./store/useThemeStore";
import { buildColors, breakpoints, fonts, radius, space, type, type Colors } from "./theme";

export interface Theme {
  c: Colors;
  space: typeof space;
  radius: typeof radius;
  fonts: typeof fonts;
  type: typeof type;
  isDark: boolean;
}

/** Theme tokens for the current mode + tenant accent. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const { preference, brandColor } = useThemeStore();
  const isDark = preference === "dark" || (preference === "system" && system === "dark");
  return useMemo(
    () => ({ c: buildColors(isDark ? "dark" : "light", brandColor), space, radius, fonts, type, isDark }),
    [isDark, brandColor],
  );
}

/** Responsive helpers. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isPhone: width < breakpoints.tablet,
    isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
    isDesktop: width >= breakpoints.desktop,
  };
}
