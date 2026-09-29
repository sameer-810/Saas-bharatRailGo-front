/**
 * Platform super-admin console (/admin). Own login, own token, own shell.
 */
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Building2, ClipboardList, DatabaseBackup, LayoutDashboard, LogOut, Tags } from "lucide-react-native";
import { useLayout, useTheme } from "@shared/useTheme";
import { Banner, Button, Card, Col, IconButton, Row, Text, TextField } from "@shared/ui";
import { adminApiClient } from "@shared/api/adminApiClient";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useAdminStore } from "@shared/store/useAdminStore";
import { adminAppScreens } from "./routes";

const Stack = createNativeStackNavigator();

const ADMIN_NAV = [
  { route: "AdminDashboard", label: "Overview", icon: LayoutDashboard },
  { route: "AdminOrgs", label: "Agencies", icon: Building2 },
  { route: "AdminPlans", label: "Plans", icon: Tags },
  { route: "AdminAudit", label: "Audit log", icon: ClipboardList },
  { route: "AdminBackups", label: "Backups", icon: DatabaseBackup },
];
const SECTION: Record<string, string> = { AdminOrgDetail: "AdminOrgs" };

function AdminLoginScreen() {
  const t = useTheme();
  const setSession = useAdminStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminApiClient.post("/auth/login", { email, password });
      setSession(res.data.data.accessToken, res.data.data.admin);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: t.c.board, justifyContent: "center", padding: 20 }}>
      <Card style={{ width: "100%", maxWidth: 400, alignSelf: "center" }} padding={28}>
        <Col gap={16}>
          <Text variant="overline" tone="accent">
            Platform console
          </Text>
          <Text variant="h1">Admin sign in</Text>
          {error ? <Banner tone="danger" title={error} testID="admin-login-error" /> : null}
          <TextField testID="admin-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextField
            testID="admin-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={submit}
          />
          <Button testID="admin-login-submit" title="Sign in" loading={busy} onPress={submit} fullWidth />
        </Col>
      </Card>
    </View>
  );
}

function AdminShell({ current, children, navigate }: { current: string; children: React.ReactNode; navigate: (r: string) => void }) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const { admin, logout } = useAdminStore();
  const active = SECTION[current] || current;
  const items = ADMIN_NAV.map((n) => {
    const on = n.route === active;
    const Icon = n.icon;
    return (
      <Pressable
        key={n.route}
        testID={`admin-nav-${n.route}`}
        onPress={() => navigate(n.route)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
          height: 40,
          borderRadius: t.radius.md,
          backgroundColor: on ? "rgba(255,201,64,0.14)" : "transparent",
        }}
      >
        <Icon size={17} color={on ? t.c.boardText : "#9AA3AF"} />
        {!isPhone ? (
          <Text variant="label" style={{ color: on ? t.c.boardText : "#D1D5DB" }}>
            {n.label}
          </Text>
        ) : null}
      </Pressable>
    );
  });
  return (
    <View style={{ flex: 1, flexDirection: isPhone ? "column" : "row", backgroundColor: t.c.bg }}>
      <View
        style={{
          backgroundColor: t.c.board,
          width: isPhone ? "100%" : 230,
          padding: 14,
          gap: 6,
          flexDirection: isPhone ? "row" : "column",
          alignItems: isPhone ? "center" : "stretch",
        }}
      >
        {!isPhone ? (
          <Text style={{ fontFamily: t.fonts.monoBold, color: t.c.boardText, letterSpacing: 2, marginBottom: 16, fontSize: 13 }}>
            BHARATRAILGO · ADMIN
          </Text>
        ) : null}
        {items}
        <View style={{ flex: 1 }} />
        <Row gap={6}>
          {!isPhone ? (
            <Text variant="caption" style={{ color: "#9AA3AF", flex: 1 }} numberOfLines={1}>
              {admin?.email}
            </Text>
          ) : null}
          <IconButton icon={LogOut} label="Log out" testID="admin-logout" onPress={logout} />
        </Row>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function AdminNavigator() {
  const token = useAdminStore((s) => s.token);
  if (!token) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ title: "Admin · BharatRailGo" }} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: "fade" }}
      layout={({ children, state, navigation }) => (
        <AdminShell
          current={state.routes[state.index]?.name ?? "AdminDashboard"}
          navigate={(r) => (navigation as unknown as { navigate: (r: string) => void }).navigate(r)}
        >
          {children}
        </AdminShell>
      )}
    >
      {Object.entries(adminAppScreens).map(([name, component]) => (
        <Stack.Screen key={name} name={name} component={component as React.ComponentType} options={{ title: `${name} · Admin` }} />
      ))}
    </Stack.Navigator>
  );
}
