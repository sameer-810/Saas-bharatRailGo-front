/**
 * Platform backups — schedule, destination (Google Drive / email fallback),
 * recent runs, and "Run backup now" (same run as the nightly cron).
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DatabaseBackup, Play } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  DataList,
  KeyValue,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  confirm,
  toast,
  type Column,
} from "@shared/ui";
import { adminApiClient } from "@shared/api/adminApiClient";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDateTime } from "@shared/lib/format";
import { useAdminMutation } from "../api";

interface BackupRun {
  id: string;
  trigger: "schedule" | "manual" | "cli";
  status: "running" | "success" | "failed";
  fileName?: string;
  sizeBytes?: number;
  collections?: number;
  documents?: number;
  destination?: string;
  error?: string;
  tookMs?: number;
  createdAt: string;
}

interface BackupStatus {
  config: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    destination: string;
    driveConfigured: boolean;
    running: boolean;
  };
  runs: BackupRun[];
}

const mb = (b?: number) => (b == null ? "—" : `${(b / 1024 / 1024).toFixed(2)} MB`);

export function AdminBackupsScreen() {
  const status = useQuery({
    queryKey: ["admin", "backup"],
    queryFn: async () => (await adminApiClient.get("/backup")).data.data as BackupStatus,
  });
  const run = useAdminMutation(async () => (await adminApiClient.post("/backup/run")).data);

  const runNow = async () => {
    const ok = await confirm({
      title: "Run a full backup now?",
      message: "Exports the whole database and uploads it to the backup destination. Takes a few seconds to minutes.",
      confirmLabel: "Run backup",
    });
    if (!ok) return;
    try {
      const res = await run.mutateAsync(undefined);
      toast.success((res as { message?: string }).message || "Backup completed");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const cfg = status.data?.config;
  const columns: Column<BackupRun>[] = [
    { key: "when", title: "When", flex: 1.3, render: (r) => <Text>{formatDateTime(r.createdAt)}</Text> },
    { key: "status", title: "Status", render: (r) => <StatusPill status={r.status === "success" ? "ok" : r.status === "failed" ? "expired" : "pending"} label={r.status} /> },
    { key: "trigger", title: "Trigger", render: (r) => <Text tone="muted">{r.trigger}</Text> },
    { key: "size", title: "Size", render: (r) => <Text variant="mono">{mb(r.sizeBytes)}</Text> },
    { key: "docs", title: "Records", render: (r) => <Text variant="mono">{r.documents ?? "—"}</Text> },
    {
      key: "dest",
      title: "Destination / error",
      flex: 2.4,
      render: (r) => (
        <Text variant="caption" tone={r.status === "failed" ? "danger" : "muted"} numberOfLines={2}>
          {r.status === "failed" ? r.error : r.destination}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      title="Backups"
      subtitle="Nightly full-database backup (Plusveda design): Google Drive, email fallback, failure alerts."
      actions={<Button title="Run backup now" icon={Play} loading={run.isPending} onPress={runNow} testID="admin-backup-run" />}
      testID="admin-backups"
    >
      {cfg && !cfg.driveConfigured ? (
        <Banner
          tone="warning"
          title="Google Drive is not connected"
          message="Backups fall back to email (size-limited). Run scripts/googleDriveAuth.js once — see docs/BACKUP_SETUP.md in the API repo."
          testID="admin-backup-drive-warning"
        />
      ) : null}
      <Card style={{ marginTop: 12 }} testID="admin-backup-config">
        <KeyValue
          items={[
            ["Schedule", cfg ? `${cfg.schedule} (UTC)${cfg.enabled ? "" : " — disabled"}` : "—"],
            ["Destination", cfg?.destination || "—"],
            ["Keep for", cfg ? `${cfg.retentionDays} days` : "—"],
          ]}
        />
      </Card>
      <SectionHeader title="Recent runs" />
      <DataList
        testID="admin-backup-runs"
        rows={status.data?.runs}
        columns={columns}
        keyOf={(r) => r.id}
        loading={status.isLoading}
        error={status.error}
        onRetry={() => status.refetch()}
        phoneRight={(r) => <StatusPill status={r.status === "success" ? "ok" : "expired"} label={r.status} />}
        empty={
          <Card>
            <Text tone="muted">
              <DatabaseBackup size={14} /> No backups yet — run one now or wait for the nightly schedule.
            </Text>
          </Card>
        }
      />
    </Screen>
  );
}
