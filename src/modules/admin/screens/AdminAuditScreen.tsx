/** Platform audit log: every admin action, newest first. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Col, Row, Screen, TextField } from "@shared/ui";
import { useLayout } from "@shared/useTheme";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAdminNav, useParams } from "@navigation/useAppNav";
import { useAdminAudit } from "../api";
import { AuditList } from "../components/AuditList";

/** Actions written by admin.service.js (the backend filters on exact match). */
const ACTIONS = [
  "organization.approve",
  "organization.reject",
  "organization.suspend",
  "organization.reactivate",
  "organization.subscription",
  "organization.limits",
  "organization.revoke_sessions",
  "plan.create",
  "plan.update",
  "organization.purge",
  "backup.run",
];

export function AdminAuditScreen() {
  const { isPhone } = useLayout();
  const nav = useAdminNav();
  const params = useParams<{ organization?: string; action?: string }>();
  const [action, setAction] = useState(params.action ?? "");
  const [page, setPage] = useState(1);
  const q = useDebounced(action.trim());

  useEffect(() => setPage(1), [q]);

  const audit = useAdminAudit({ action: q || undefined, organization: params.organization, page, limit: 25 });

  return (
    <Screen
      title="Audit log"
      subtitle={audit.data ? `${audit.data.meta.total} entries` : "Every platform-admin action"}
      testID="admin-audit"
    >
      <Col gap={10} style={{ marginBottom: 16 }}>
        <View style={{ maxWidth: isPhone ? undefined : 420 }}>
          <TextField
            testID="admin-audit-action"
            label="Action"
            value={action}
            onChangeText={setAction}
            placeholder="e.g. organization.suspend"
            autoCapitalize="none"
            mono
            hint="Exact action name"
          />
        </View>
        <Row gap={6} wrap testID="admin-audit-action-chips">
          <Chip label="All" selected={!q} onPress={() => setAction("")} testID="admin-audit-action-all" />
          {ACTIONS.map((a) => (
            <Chip
              key={a}
              label={a.replace("organization.", "org.")}
              selected={q === a}
              onPress={() => setAction(a)}
              testID={`admin-audit-action-${a}`}
            />
          ))}
        </Row>
      </Col>
      <AuditList
        testID="admin-audit-list"
        rows={audit.data?.items}
        loading={audit.isLoading || audit.isFetching}
        error={audit.error ? { message: apiErrorMessage(audit.error) } : undefined}
        onRetry={() => audit.refetch()}
        paging={audit.data?.meta}
        onPage={setPage}
        onOrgPress={(id) => nav.navigate("AdminOrgDetail", { id })}
      />
    </Screen>
  );
}
