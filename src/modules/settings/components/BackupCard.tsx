/**
 * "Data backup" — the owner emails a complete copy of the agency's data to
 * themselves (zip: readable backup.xlsx + restore files). The destination is
 * the backup email saved here, or the owner's login email.
 */
import React, { useEffect, useState } from "react";
import { DatabaseBackup, Mail } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Col, Row, Text, TextField, toast } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { apiClient, apiErrorMessage } from "@shared/api/apiClient";
import { useBusinessProfile } from "@shared/api/lookups";
import { useAuthStore } from "@shared/store/useAuthStore";

export function BackupCard() {
  const t = useTheme();
  const qc = useQueryClient();
  const profile = useBusinessProfile();
  const loginEmail = useAuthStore((s) => s.user?.email);
  const saved = (profile.data as { backupEmail?: string } | undefined)?.backupEmail || "";
  const [email, setEmail] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => setEmail(saved), [saved]);

  const saveEmail = async () => {
    setSaving(true);
    try {
      await apiClient.patch("/business-profile", { backupEmail: email.trim() });
      qc.invalidateQueries({ queryKey: ["business-profile"] });
      toast.success(email.trim() ? "Backup email saved" : "Backups will go to your login email");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await apiClient.post("/backup/email");
      const d = res.data.data as { emailedTo: string; delivered: boolean; documents: number };
      if (d.delivered) toast.success(`Backup of ${d.documents} records sent to ${d.emailedTo}`);
      else toast.info("Backup prepared, but email is not set up on the server yet");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card testID="backup-card">
      <Row gap={14} align="flex-start" wrap>
        <DatabaseBackup size={22} color={t.c.accent} />
        <Col gap={10} flex={1} style={{ minWidth: 240 }}>
          <Col gap={4}>
            <Text variant="h3">Data backup</Text>
            <Text variant="caption" tone="muted">
              Email yourself a complete copy of your agency&apos;s data — a spreadsheet you can open plus the files
              needed to restore your account. We also back up the whole platform every night.
            </Text>
          </Col>
          <Row gap={8} align="flex-end" wrap>
            <Col flex={1} style={{ minWidth: 220 }}>
              <TextField
                testID="backup-email"
                label="Send backups to"
                placeholder={loginEmail || "you@agency.com"}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                hint={email ? undefined : `Blank = your login email (${loginEmail})`}
              />
            </Col>
            <Button title="Save" variant="secondary" loading={saving} onPress={saveEmail} testID="backup-email-save" />
          </Row>
          <Button
            title="Email my backup now"
            icon={Mail}
            loading={sending}
            onPress={send}
            testID="backup-send"
          />
        </Col>
      </Row>
    </Card>
  );
}
