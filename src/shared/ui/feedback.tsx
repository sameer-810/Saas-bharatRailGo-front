/**
 * Imperative feedback: toast() and confirm(). Mount <FeedbackHost /> once at
 * the app root.
 *
 *   toast.success("Bilti saved");
 *   toast.error(apiErrorMessage(err));
 *   if (await confirm({ title: "Delete party?", danger: true })) { ... }
 */
import React, { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react-native";
import { useTheme } from "../useTheme";
import { Row, Text } from "./primitives";
import { Button } from "./controls";
import { Dialog } from "./layout";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ConfirmReq {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const useFeedback = create<{
  toasts: ToastItem[];
  confirmReq: ConfirmReq | null;
}>(() => ({ toasts: [], confirmReq: null }));

let nextId = 1;
function push(kind: ToastKind, message: string) {
  const id = nextId++;
  useFeedback.setState((s) => ({ toasts: [...s.toasts, { id, kind, message }].slice(-3) }));
  setTimeout(() => {
    useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, kind === "error" ? 6000 : 3200);
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
};

export function confirm(opts: Omit<ConfirmReq, "resolve">): Promise<boolean> {
  return new Promise((resolve) => useFeedback.setState({ confirmReq: { ...opts, resolve } }));
}

function ToastView({ item }: { item: ToastItem }) {
  const t = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
  }, [anim]);
  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? AlertTriangle : Info;
  const color = item.kind === "success" ? t.c.success : item.kind === "error" ? t.c.danger : t.c.info;
  return (
    <Animated.View
      testID={`toast-${item.kind}`}
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        backgroundColor: t.c.surface,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.c.border,
        borderLeftWidth: 3,
        borderLeftColor: color,
        paddingHorizontal: 14,
        paddingVertical: 12,
        maxWidth: 440,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <Row gap={10}>
        <Icon size={18} color={color} />
        <Text style={{ flexShrink: 1 }}>{item.message}</Text>
      </Row>
    </Animated.View>
  );
}

export function FeedbackHost() {
  const { toasts, confirmReq } = useFeedback();
  const close = (ok: boolean) => {
    confirmReq?.resolve(ok);
    useFeedback.setState({ confirmReq: null });
  };
  return (
    <>
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", bottom: 24, left: 16, right: 16, alignItems: "center", gap: 8 }}
      >
        {toasts.map((t) => (
          <ToastView key={t.id} item={t} />
        ))}
      </View>
      <Dialog
        visible={!!confirmReq}
        onClose={() => close(false)}
        title={confirmReq?.title || ""}
        width={420}
        testID="confirm-dialog"
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => close(false)} testID="confirm-cancel" />
            <Button
              title={confirmReq?.confirmLabel || "Confirm"}
              variant={confirmReq?.danger ? "danger" : "primary"}
              onPress={() => close(true)}
              testID="confirm-ok"
            />
          </>
        }
      >
        {confirmReq?.message ? <Text tone="muted">{confirmReq.message}</Text> : null}
      </Dialog>
    </>
  );
}
