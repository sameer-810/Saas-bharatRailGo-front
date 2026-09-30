import React from "react";
import { Platform, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { RootNavigator } from "@navigation/RootNavigator";
import { navigationRef } from "@navigation/navigationRef";
import { appPaths, adminPaths } from "@navigation/routes";
import { FeedbackHost } from "@shared/ui";
import { useTheme } from "@shared/useTheme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});

/** Browser URLs ↔ routes: refresh, back/forward and shareable links work on web. */
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [],
  config: {
    screens: {
      Auth: {
        screens: { Login: "login", Signup: "signup", Pending: "pending" },
      },
      App: { screens: appPaths },
      Admin: { screens: adminPaths },
    },
  },
};

function Themed() {
  const t = useTheme();
  const navTheme = {
    ...(t.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.isDark ? DarkTheme : DefaultTheme).colors,
      background: t.c.bg,
      card: t.c.surface,
      text: t.c.text,
      border: t.c.border,
      primary: t.c.accent,
    },
  };
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        theme={navTheme}
        documentTitle={{
          formatter: (options) => options?.title ?? "BharatRailGo",
        }}
      >
        <RootNavigator />
      </NavigationContainer>
      <FeedbackHost />
      <StatusBar style={t.isDark ? "light" : "dark"} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  if (!fontsLoaded && Platform.OS !== "web") return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Themed />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
