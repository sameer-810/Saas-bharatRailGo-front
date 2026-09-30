/**
 * Command palette — Ctrl/⌘ K anywhere (web/desktop), search button on phones.
 * Finds screens, quick actions, parties and bilti in one box. Arrow keys +
 * Enter on keyboards.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { create } from "zustand";
import {
  ArrowRight,
  Search,
  User,
  Zap,
  ReceiptText,
} from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import { Row, Text } from "@shared/ui";
import { apiClient } from "@shared/api/apiClient";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAuthStore } from "@shared/store/useAuthStore";
import { can } from "@shared/lib/permissions";
import { NAV_ITEMS, QUICK_ACTIONS } from "./navItems";
import { navigationRef } from "./navigationRef";

export const useCommandPalette = create<{
  open: boolean;
  setOpen: (o: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Entry {
  key: string;
  label: string;
  hint: string;
  icon: typeof Search;
  run: () => void;
}

function go(route: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady())
    (
      navigationRef as unknown as { navigate: (r: string, p?: unknown) => void }
    ).navigate(route, params);
}

export function CommandPalette() {
  const t = useTheme();
  const { open, setOpen } = useCommandPalette();
  const role = useAuthStore((s) => s.user?.role);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<Entry[]>([]);
  const dq = useDebounced(q, 200);

  // Global shortcut
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useCommandPalette
          .getState()
          .setOpen(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  // Live lookups: parties + bilti
  useEffect(() => {
    if (!open || dq.trim().length < 2) {
      setRemote([]);
      return;
    }
    let alive = true;
    Promise.all([
      apiClient
        .get("/parties", { params: { search: dq, limit: 5 } })
        .catch(() => null),
      apiClient
        .get("/pods", { params: { search: dq, limit: 5 } })
        .catch(() => null),
    ]).then(([parties, pods]) => {
      if (!alive) return;
      const out: Entry[] = [];
      for (const p of parties?.data?.data || []) {
        out.push({
          key: `party-${p.id}`,
          label: p.name,
          hint: "Party",
          icon: User,
          run: () => go("PartyDetail", { id: p.id }),
        });
      }
      for (const b of pods?.data?.data || []) {
        out.push({
          key: `pod-${b.id}`,
          label: `Bilti ${b.podNumber} · ${b.consignorName} → ${b.destinationStation}`,
          hint: "Bilti",
          icon: ReceiptText,
          run: () => go("BiltiDetail", { id: b.id }),
        });
      }
      setRemote(out);
    });
    return () => {
      alive = false;
    };
  }, [dq, open]);

  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: string) => !needle || s.toLowerCase().includes(needle);
    const actions: Entry[] = QUICK_ACTIONS.filter(
      (a) => !a.perm || can(role, a.perm),
    )
      .filter((a) => match(`${a.label} ${a.keywords}`))
      .map((a) => ({
        key: `a-${a.route}`,
        label: a.label,
        hint: "Action",
        icon: Zap,
        run: () => go(a.route),
      }));
    const screens: Entry[] = NAV_ITEMS.filter(
      (n) => !n.perm || can(role, n.perm),
    )
      .filter((n) => match(`${n.label} ${n.keywords || ""}`))
      .map((n) => ({
        key: `s-${n.route}`,
        label: n.label,
        hint: "Go to",
        icon: n.icon,
        run: () => go(n.route),
      }));
    return [...actions, ...screens, ...remote].slice(0, 14);
  }, [q, remote, role]);

  const runAt = (i: number) => {
    const e = entries[i];
    if (!e) return;
    setOpen(false);
    e.run();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
    >
      <Pressable
        onPress={() => setOpen(false)}
        style={{
          flex: 1,
          backgroundColor: t.c.overlay,
          alignItems: "center",
          paddingTop: 80,
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          onPress={() => undefined}
          testID="command-palette"
          style={{
            width: "100%",
            maxWidth: 620,
            backgroundColor: t.c.surface,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.c.border,
            overflow: "hidden",
          }}
        >
          <Row
            gap={10}
            style={{
              paddingHorizontal: 16,
              height: 56,
              borderBottomWidth: 1,
              borderBottomColor: t.c.border,
            }}
          >
            <Search size={18} color={t.c.textFaint} />
            <TextInput
              autoFocus
              testID="command-input"
              value={q}
              onChangeText={(s) => {
                setQ(s);
                setCursor(0);
              }}
              placeholder="Search parties, bilti, or type an action…"
              placeholderTextColor={t.c.textFaint}
              onKeyPress={(e) => {
                const key = (e.nativeEvent as { key: string }).key;
                if (key === "ArrowDown")
                  setCursor((c) => Math.min(c + 1, entries.length - 1));
                if (key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
                if (key === "Escape") setOpen(false);
              }}
              onSubmitEditing={() => runAt(cursor)}
              style={[
                t.type.body,
                { flex: 1, color: t.c.text },
                Platform.OS === "web" && ({ outlineStyle: "none" } as object),
              ]}
            />
            <Text variant="caption" tone="faint">
              Esc
            </Text>
          </Row>
          <ScrollView
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
          >
            {entries.length === 0 ? (
              <Text tone="faint" style={{ padding: 16 }}>
                No matches
              </Text>
            ) : (
              entries.map((e, i) => {
                const Icon = e.icon;
                const active = i === cursor;
                return (
                  <Pressable
                    key={e.key}
                    testID={`cmd-${e.key}`}
                    onPress={() => runAt(i)}
                    onHoverIn={() => setCursor(i)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingHorizontal: 16,
                      height: 48,
                      backgroundColor: active ? t.c.accentSoft : "transparent",
                    }}
                  >
                    <Icon
                      size={16}
                      color={active ? t.c.accent : t.c.textMuted}
                    />
                    <Text style={{ flex: 1 }} numberOfLines={1}>
                      {e.label}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {e.hint}
                    </Text>
                    {active ? (
                      <ArrowRight size={14} color={t.c.accent} />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
