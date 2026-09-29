/**
 * Privacy & data (owner) — the agency's own rights under the DPDP Act 2023:
 * see the consent it gave, download everything, and close the account.
 */
import React, { useState } from "react";
import { Download, FileCheck2, Trash2 } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, Button, Card, Col, LoadingBlock, Row, Screen, Text, TextField, confirm, toast } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiGet } from "@shared/api/query";
import { apiClient, apiErrorMessage } from "@shared/api/apiClient";
import { downloadFile } from "@shared/api/files";
import { formatDate, formatDateTime } from "@shared/lib/format";

interface AccountPrivacy {
  consent: { termsVersion: string; acceptedAt: string } | null;
  deletion: { requestedAt: string | null; purgeAllowedFrom: string | null; graceDays: number; reason: string | null };
}

function Section({
  icon: Icon,
  title,
  children,
  testID,
}: {
  icon: typeof Download;
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Card testID={testID}>
      <Row gap={14} align="flex-start" wrap>
        <Icon size={22} color={t.c.accent} />
        <Col gap={10} flex={1} style={{ minWidth: 240 }}>
          <Text variant="h3">{title}</Text>
          {children}
        </Col>
      </Row>
    </Card>
  );
}

export function PrivacyScreen() {
  const qc = useQueryClient();
  const status = useApiGet<AccountPrivacy>(["privacy", "account"], "/privacy/account");
  const [downloading, setDownloading] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["privacy"] });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadFile("/privacy/account/export", `bharatrailgo-data-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success("Your data is downloading");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const onRequest = async () => {
    const ok = await confirm({
      title: "Delete your agency's account?",
      message: `Everything — bookings, bilti, bills, parties, payments, team — will be permanently deleted after ${
        status.data?.deletion.graceDays ?? 30
      } days. Download your data first. You can cancel until then.`,
      confirmLabel: "Request deletion",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await apiClient.post("/privacy/account/deletion", { password, reason: reason.trim() || undefined });
      toast.success(res.data.message || "Deletion requested");
      setPassword("");
      setReason("");
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      await apiClient.delete("/privacy/account/deletion");
      toast.success("Deletion cancelled — your account stays");
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const d = status.data?.deletion;

  return (
    <Screen
      title="Privacy & data"
      subtitle="Your data belongs to you."
      back
      backTo="Settings"
      maxWidth={860}
      testID="privacy-screen"
    >
      {!status.data ? (
        <LoadingBlock rows={4} />
      ) : (
        <Col gap={14}>
          {d?.requestedAt ? (
            <Banner
              testID="privacy-deletion-banner"
              tone="danger"
              title="Account deletion requested"
              message={`Requested on ${formatDate(d.requestedAt)}. All data may be permanently deleted from ${formatDate(
                d.purgeAllowedFrom,
              )}. Cancel if this was a mistake.`}
              action={
                <Button
                  testID="privacy-deletion-cancel"
                  title="Cancel deletion"
                  variant="secondary"
                  size="sm"
                  loading={busy}
                  onPress={onCancel}
                />
              }
            />
          ) : null}

          <Section icon={Download} title="Download all your data" testID="privacy-export-card">
            <Text variant="caption" tone="muted">
              A zip with a spreadsheet you can open (parties, bookings, bilti, GST bills, payments, branches) and the
              complete data files. Passwords are never included.
            </Text>
            <Row>
              <Button
                testID="privacy-export"
                title="Download my data"
                icon={Download}
                loading={downloading}
                onPress={onDownload}
              />
            </Row>
          </Section>

          <Section icon={FileCheck2} title="Terms & privacy consent" testID="privacy-consent-card">
            {status.data.consent ? (
              <Text variant="caption" tone="muted" testID="privacy-consent">
                You accepted the Terms and Privacy Policy (version {status.data.consent.termsVersion}) on{" "}
                {formatDateTime(status.data.consent.acceptedAt)}.
              </Text>
            ) : (
              <Text variant="caption" tone="muted" testID="privacy-consent">
                This account was created before consent was recorded.
              </Text>
            )}
            <Text variant="caption" tone="muted">
              Your customers&apos; data: you decide what is kept. Open a party to download or erase that customer&apos;s
              data when they ask.
            </Text>
          </Section>

          {!d?.requestedAt ? (
            <Section icon={Trash2} title="Delete your account" testID="privacy-deletion-card">
              <Text variant="caption" tone="muted">
                After you ask, you have {d?.graceDays ?? 30} days to change your mind. Then all of your agency&apos;s
                data is permanently deleted. Our GST invoices for your subscription are kept, as the law requires.
              </Text>
              <TextField
                testID="privacy-deletion-reason"
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="Tell us why — it helps"
              />
              <TextField
                testID="privacy-deletion-password"
                label="Your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Row>
                <Button
                  testID="privacy-deletion-request"
                  title="Request account deletion"
                  variant="danger"
                  icon={Trash2}
                  loading={busy}
                  disabled={!password}
                  onPress={onRequest}
                />
              </Row>
            </Section>
          ) : null}
        </Col>
      )}
    </Screen>
  );
}
