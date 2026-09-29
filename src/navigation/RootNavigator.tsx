/**
 * Root: Auth stack (signed out) or App stack (signed in); the platform
 * Admin console is always mounted at /admin with its own separate session.
 */
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore, useIsAuthenticated } from "@shared/store/useAuthStore";
import { useTheme } from "@shared/useTheme";
import { LoginScreen } from "@modules/auth/LoginScreen";
import { SignupScreen } from "@modules/auth/SignupScreen";
import { PendingScreen } from "@modules/auth/PendingScreen";
import { appScreens } from "./routes";
import { AppShell } from "./AppShell";
import { AdminNavigator } from "./AdminNavigator";

const Root = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen as React.ComponentType} options={{ title: "Sign in · BharatRailGo" }} />
      <AuthStack.Screen name="Signup" component={SignupScreen as React.ComponentType} options={{ title: "Start free trial · BharatRailGo" }} />
      <AuthStack.Screen name="Pending" component={PendingScreen as React.ComponentType} options={{ title: "In review · BharatRailGo" }} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{ headerShown: false, animation: "fade" }}
      layout={({ children, state }) => (
        <AppShell current={state.routes[state.index]?.name ?? "Home"}>{children}</AppShell>
      )}
    >
      {Object.entries(appScreens).map(([name, component]) => (
        <AppStack.Screen
          key={name}
          name={name}
          component={component as React.ComponentType}
          options={{ title: `${name.replace(/([a-z])([A-Z])/g, "$1 $2")} · BharatRailGo` }}
        />
      ))}
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const t = useTheme();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const signedIn = useIsAuthenticated();

  useEffect(() => {
    if (isHydrated) useAuthStore.getState().initialize();
  }, [isHydrated]);

  if (!isHydrated || !isAuthChecked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.c.bg }}>
        <ActivityIndicator color={t.c.accent} />
      </View>
    );
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false }} key={signedIn ? "app" : "auth"}>
      {signedIn ? (
        <Root.Screen name="App" component={AppNavigator} />
      ) : (
        <Root.Screen name="Auth" component={AuthNavigator} />
      )}
      <Root.Screen name="Admin" component={AdminNavigator} />
    </Root.Navigator>
  );
}
