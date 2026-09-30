/** Audit trail table, used by AdminAudit and the org detail screen. */
import React from "react";
import { DataList, EmptyState, Text, type Column } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { formatDateTime } from "@shared/lib/format";
import { ClipboardList } from "lucide-react-native";
import type { Paging } from "@shared/api/apiClient";
import type { AuditEntry } from "../api";
import { metaSummary } from "./OrgBits";

export function AuditList({
  rows,
  loading,
  error,
  onRetry,
  paging,
  onPage,
  showOrg = true,
  onOrgPress,
  testID = "admin-audit-list",
}: {
  rows: AuditEntry[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  paging?: Paging;
  onPage?: (p: number) => void;
  showOrg?: boolean;
  onOrgPress?: (orgId: string) => void;
  testID?: string;
}) {
  const t = useTheme();
  const mono = { fontFamily: t.fonts.mono };
  const columns: Column<AuditEntry>[] = [
    {
      key: "action",
      title: "Action",
      flex: 1.3,
      render: (r) => (
        <Text variant="bodyStrong" style={mono} numberOfLines={1}>
          {r.action}
        </Text>
      ),
    },
    {
      key: "time",
      title: "Time",
      flex: 1,
      render: (r) => (
        <Text variant="caption" tone="muted">
          {formatDateTime(r.createdAt)}
        </Text>
      ),
    },
    {
      key: "admin",
      title: "Admin",
      flex: 1.3,
      render: (r) => (
        <Text variant="caption" numberOfLines={1}>
          {r.adminEmail || "—"}
        </Text>
      ),
    },
  ];
  if (showOrg) {
    columns.push({
      key: "org",
      title: "Organization",
      flex: 1.3,
      render: (r) =>
        r.organization ? (
          <Text
            variant="caption"
            tone={onOrgPress ? "accent" : "default"}
            numberOfLines={1}
            testID={`admin-audit-org-${r._id}`}
            onPress={
              onOrgPress ? () => onOrgPress(r.organization!._id) : undefined
            }
          >
            {r.organization.name}
          </Text>
        ) : (
          <Text variant="caption" tone="faint">
            {r.targetType ? `${r.targetType} ${r.targetId ?? ""}` : "—"}
          </Text>
        ),
    });
  }
  columns.push({
    key: "meta",
    title: "Details",
    flex: 2,
    render: (r) => (
      <Text variant="caption" tone="muted" style={mono} numberOfLines={2}>
        {metaSummary(r.meta) || "—"}
      </Text>
    ),
  });
  return (
    <DataList
      testID={testID}
      rows={rows}
      columns={columns}
      keyOf={(r) => r._id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      paging={paging}
      onPage={onPage}
      empty={
        <EmptyState
          icon={ClipboardList}
          title="No audit entries"
          message="Admin actions will be listed here."
        />
      }
    />
  );
}
