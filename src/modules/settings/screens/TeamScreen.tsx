/**
 * Team — list users, add staff/managers, activate/deactivate, reset password,
 * change role and branches. Owner manages everyone; managers only staff.
 */
import React, { useMemo, useState } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  Power,
  UserPlus,
  Users,
} from "lucide-react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Banner,
  Button,
  Chip,
  Col,
  DataList,
  Dialog,
  EmptyState,
  IconButton,
  Row,
  Screen,
  SegmentedControl,
  StatusPill,
  Text,
  TextField,
  confirm,
  toast,
  type Column,
} from "@shared/ui";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorCode, apiErrorMessage } from "@shared/api/apiClient";
import { useBranches, type Branch } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatDateTime } from "@shared/lib/format";
import { useAuthStore } from "@shared/store/useAuthStore";
import type { TeamUser } from "../types";
import {
  PlanLimitBanner,
  ReadOnlyBanner,
  atLimit,
  usageText,
  useSubscription,
} from "../components/common";

type EditableRole = "staff" | "manager";

function BranchPicker({
  branches,
  value,
  onChange,
  error,
  testID,
}: {
  branches: Branch[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
  testID: string;
}) {
  return (
    <Col gap={6}>
      <Text variant="label" tone="muted">
        Branches
      </Text>
      <Row wrap gap={8}>
        {branches.map((b) => {
          const on = value.includes(b.id);
          return (
            <Chip
              key={b.id}
              testID={`${testID}-${b.code}`}
              label={`${b.name}${b.isHeadOffice ? " (HO)" : ""}`}
              selected={on}
              onPress={() =>
                onChange(
                  on ? value.filter((x) => x !== b.id) : [...value, b.id],
                )
              }
            />
          );
        })}
      </Row>
      <Text variant="caption" tone={error ? "danger" : "faint"}>
        {error ||
          "Staff only see bookings of these branches. None selected = head office."}
      </Text>
    </Col>
  );
}

function RolePicker({
  value,
  onChange,
  testID,
}: {
  value: EditableRole;
  onChange: (r: EditableRole) => void;
  testID: string;
}) {
  const canManagers = useCan("users.manageManagers");
  if (!canManagers) {
    return (
      <Col gap={4}>
        <Text variant="label" tone="muted">
          Role
        </Text>
        <Text>Staff</Text>
        <Text variant="caption" tone="faint">
          Only the owner can create managers.
        </Text>
      </Col>
    );
  }
  return (
    <Col gap={6}>
      <Text variant="label" tone="muted">
        Role
      </Text>
      <SegmentedControl<EditableRole>
        testID={testID}
        value={value}
        onChange={onChange}
        options={[
          { value: "staff", label: "Staff" },
          { value: "manager", label: "Manager" },
        ]}
      />
      <Text variant="caption" tone="faint">
        {value === "manager"
          ? "Managers see every branch, manage staff and masters, and can delete records."
          : "Staff do day-to-day entry in their branches and cannot delete."}
      </Text>
    </Col>
  );
}

/* ─────────────── Add user ─────────────── */

const addSchema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  role: z.enum(["staff", "manager"]),
  branches: z.array(z.string()),
});
type AddForm = z.infer<typeof addSchema>;

function AddUserDialog({
  visible,
  onClose,
  branches,
  onLimit,
}: {
  visible: boolean;
  onClose: () => void;
  branches: Branch[];
  onLimit: () => void;
}) {
  const [limitHit, setLimitHit] = useState(false);
  const create = useApiMutation<TeamUser, AddForm>("post", "/auth/users", {
    invalidate: ["users"],
    body: (v) => ({
      ...v,
      email: v.email.trim().toLowerCase(),
      branches: v.role === "staff" ? v.branches : undefined,
    }),
  });
  const { control, handleSubmit, reset } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "staff",
      branches: [],
    },
  });
  const role = useWatch({ control, name: "role" });

  const close = () => {
    reset();
    setLimitHit(false);
    onClose();
  };

  const submit = handleSubmit(async (v) => {
    setLimitHit(false);
    try {
      await create.mutateAsync(v);
      toast.success(`${v.name} added — share the email and password with them`);
      close();
    } catch (err) {
      if (apiErrorCode(err) === "PLAN_LIMIT_REACHED") {
        setLimitHit(true);
        onLimit();
      }
      toast.error(apiErrorMessage(err));
    }
  });

  return (
    <Dialog
      visible={visible}
      onClose={close}
      title="Add user"
      testID="team-add-dialog"
      footer={
        <>
          <Button
            testID="team-add-cancel"
            title="Cancel"
            variant="secondary"
            onPress={close}
          />
          <Button
            testID="team-add-save"
            title="Add user"
            icon={UserPlus}
            loading={create.isPending}
            onPress={submit}
          />
        </>
      }
    >
      {limitHit ? (
        <PlanLimitBanner what="users" testID="team-add-limit" />
      ) : null}
      <Controller
        control={control}
        name="name"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="team-add-name"
            label="Name"
            value={f.value}
            onChangeText={f.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="team-add-email"
            label="Email (used to log in)"
            value={f.value}
            onChangeText={f.onChange}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: f, fieldState }) => (
          <TextField
            testID="team-add-password"
            label="Password"
            value={f.value}
            onChangeText={f.onChange}
            secureTextEntry
            autoCapitalize="none"
            hint="At least 6 characters. They can't change it themselves yet — you can reset it any time."
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="role"
        render={({ field: f }) => (
          <RolePicker
            testID="team-add-role"
            value={f.value}
            onChange={f.onChange}
          />
        )}
      />
      {role === "staff" ? (
        <Controller
          control={control}
          name="branches"
          render={({ field: f }) => (
            <BranchPicker
              testID="team-add-branch"
              branches={branches}
              value={f.value}
              onChange={f.onChange}
            />
          )}
        />
      ) : null}
    </Dialog>
  );
}

/* ─────────────── Edit user (name / role / branches) ─────────────── */

function EditUserDialog({
  user,
  onClose,
  branches,
}: {
  user: TeamUser | null;
  onClose: () => void;
  branches: Branch[];
}) {
  const canManagers = useCan("users.manageManagers");
  const [name, setName] = useState("");
  const [role, setRole] = useState<EditableRole>("staff");
  const [picked, setPicked] = useState<string[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  if (user && user.id !== lastId) {
    setLastId(user.id);
    setName(user.name);
    setRole(user.role === "manager" ? "manager" : "staff");
    setPicked(user.branches);
  }
  const close = () => {
    setLastId(null);
    onClose();
  };
  const update = useApiMutation<
    TeamUser,
    { id: string; body: Record<string, unknown> }
  >("patch", (v) => `/auth/users/${v.id}`, {
    invalidate: ["users"],
    body: (v) => v.body,
  });

  const save = async () => {
    if (!user) return;
    const body: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== user.name) body.name = name.trim();
    if (user.role !== "owner" && role !== user.role) body.role = role;
    const nextRole = user.role === "owner" ? "owner" : role;
    if (
      nextRole === "staff" &&
      JSON.stringify([...picked].sort()) !==
        JSON.stringify([...user.branches].sort())
    ) {
      body.branches = picked;
    }
    if (!Object.keys(body).length) {
      close();
      return;
    }
    try {
      await update.mutateAsync({ id: user.id, body });
      toast.success("User updated");
      close();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog
      visible={!!user}
      onClose={close}
      title={user ? `Edit ${user.name}` : "Edit user"}
      testID="team-edit-dialog"
      footer={
        <>
          <Button
            testID="team-edit-cancel"
            title="Cancel"
            variant="secondary"
            onPress={close}
          />
          <Button
            testID="team-edit-save"
            title="Save"
            loading={update.isPending}
            onPress={save}
            disabled={!name.trim()}
          />
        </>
      }
    >
      <TextField
        testID="team-edit-name"
        label="Name"
        value={name}
        onChangeText={setName}
      />
      {user &&
      (user.role === "staff" || (user.role === "manager" && canManagers)) ? (
        <RolePicker testID="team-edit-role" value={role} onChange={setRole} />
      ) : null}
      {user && user.role !== "owner" && role === "staff" ? (
        <BranchPicker
          testID="team-edit-branch"
          branches={branches}
          value={picked}
          onChange={setPicked}
        />
      ) : null}
    </Dialog>
  );
}

/* ─────────────── Reset password ─────────────── */

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: TeamUser | null;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const update = useApiMutation<TeamUser, { id: string; password: string }>(
    "patch",
    (v) => `/auth/users/${v.id}`,
    {
      invalidate: ["users"],
      body: (v) => ({ password: v.password }),
    },
  );
  const close = () => {
    setPw("");
    setPw2("");
    onClose();
  };
  const tooShort = pw.length > 0 && pw.length < 6;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const save = async () => {
    if (!user || pw.length < 6 || pw !== pw2) return;
    try {
      await update.mutateAsync({ id: user.id, password: pw });
      toast.success(`Password reset — ${user.name} is signed out everywhere`);
      close();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };
  return (
    <Dialog
      visible={!!user}
      onClose={close}
      title={user ? `Reset password — ${user.name}` : "Reset password"}
      width={440}
      testID="team-reset-dialog"
      footer={
        <>
          <Button
            testID="team-reset-cancel"
            title="Cancel"
            variant="secondary"
            onPress={close}
          />
          <Button
            testID="team-reset-save"
            title="Reset password"
            loading={update.isPending}
            disabled={pw.length < 6 || pw !== pw2}
            onPress={save}
          />
        </>
      }
    >
      <Text tone="muted">
        They will be signed out on every device and must log in with the new
        password.
      </Text>
      <TextField
        testID="team-reset-password"
        label="New password"
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        autoCapitalize="none"
        error={tooShort ? "At least 6 characters" : undefined}
      />
      <TextField
        testID="team-reset-confirm"
        label="Repeat password"
        value={pw2}
        onChangeText={setPw2}
        secureTextEntry
        autoCapitalize="none"
        error={mismatch ? "Passwords do not match" : undefined}
      />
    </Dialog>
  );
}

/* ─────────────── Screen ─────────────── */

export function TeamScreen() {
  const canManage = useCan("users.manage");
  const canManagers = useCan("users.manageManagers");
  const readOnly = useReadOnly();
  const me = useAuthStore((s) => s.user);
  const { sub } = useSubscription();
  const users = useApiGet<TeamUser[]>(
    ["users"],
    canManage ? "/auth/users" : null,
  );
  const branchesQ = useBranches(true);
  const branches = useMemo(
    () => (branchesQ.data || []).filter((b) => b.isActive),
    [branchesQ.data],
  );
  const branchName = useMemo(() => {
    const m = new Map<string, Branch>();
    (branchesQ.data || []).forEach((b) => m.set(b.id, b));
    return m;
  }, [branchesQ.data]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [resetting, setResetting] = useState<TeamUser | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  const toggle = useApiMutation<TeamUser, { id: string; isActive: boolean }>(
    "patch",
    (v) => `/auth/users/${v.id}`,
    {
      invalidate: ["users"],
      body: (v) => ({ isActive: v.isActive }),
    },
  );

  const usedUsers = sub?.usage?.users;
  const maxUsers = sub?.limits?.maxUsers ?? null;
  const full = atLimit(usedUsers, maxUsers);

  const canTouch = (u: TeamUser) => {
    if (u.role === "owner") return false;
    if (u.role === "manager" && !canManagers) return u.id === me?.id;
    return true;
  };

  const onToggle = async (u: TeamUser) => {
    const activating = !u.isActive;
    if (!activating) {
      const ok = await confirm({
        title: `Deactivate ${u.name}?`,
        message:
          "They are signed out right away and cannot log in. Their bookings stay. You can reactivate them later.",
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await toggle.mutateAsync({ id: u.id, isActive: activating });
      toast.success(
        activating ? `${u.name} reactivated` : `${u.name} deactivated`,
      );
    } catch (err) {
      if (apiErrorCode(err) === "PLAN_LIMIT_REACHED") setLimitHit(true);
      toast.error(apiErrorMessage(err));
    }
  };

  const branchLabel = (u: TeamUser) => {
    if (u.role !== "staff") return "All branches";
    if (!u.branches.length) return "—";
    return u.branches
      .map((id) => branchName.get(id)?.name || "Removed branch")
      .join(", ");
  };

  const columns: Column<TeamUser>[] = [
    {
      key: "name",
      title: "User",
      flex: 2,
      render: (u) => (
        <Col gap={1}>
          <Text variant="bodyStrong">
            {u.name}
            {u.id === me?.id ? " (you)" : ""}
          </Text>
          <Text variant="caption" tone="muted">
            {u.email}
          </Text>
        </Col>
      ),
    },
    {
      key: "role",
      title: "Role",
      render: (u) => (
        <Text>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</Text>
      ),
    },
    {
      key: "branches",
      title: "Branches",
      flex: 1.5,
      render: (u) => (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {branchLabel(u)}
        </Text>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (u) => (
        <StatusPill
          status={u.isActive ? "active" : "inactive"}
          label={u.isActive ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "last",
      title: "Last login",
      hideOnPhone: true,
      render: (u) => (
        <Text variant="caption" tone="muted">
          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      title: "",
      align: "right",
      flex: 1.2,
      render: (u) =>
        canTouch(u) && !readOnly ? (
          <Row gap={0}>
            <IconButton
              testID={`team-edit-${u.id}`}
              icon={Pencil}
              label="Edit"
              onPress={() => setEditing(u)}
            />
            <IconButton
              testID={`team-reset-${u.id}`}
              icon={KeyRound}
              label="Reset password"
              onPress={() => setResetting(u)}
            />
            {u.id !== me?.id ? (
              <IconButton
                testID={`team-toggle-${u.id}`}
                icon={Power}
                label={u.isActive ? "Deactivate" : "Activate"}
                tone={u.isActive ? "danger" : "accent"}
                onPress={() => onToggle(u)}
              />
            ) : null}
          </Row>
        ) : (
          <Text variant="caption" tone="faint">
            {u.role === "owner" ? "Owner" : readOnly ? "" : "Owner only"}
          </Text>
        ),
    },
  ];

  if (!canManage) {
    return (
      <Screen title="Team" back backTo="Settings" testID="team-screen">
        <Banner
          tone="info"
          title="Only the owner and managers can manage the team"
        />
      </Screen>
    );
  }

  const addButton = (
    <Button
      testID="team-add"
      title="Add user"
      icon={Plus}
      disabled={readOnly}
      onPress={() => {
        if (full) {
          setLimitHit(true);
          return;
        }
        setAdding(true);
      }}
    />
  );

  return (
    <Screen
      title="Team"
      subtitle={usageText(usedUsers, maxUsers, "users")}
      back
      backTo="Settings"
      actions={addButton}
      refreshing={users.isRefetching}
      onRefresh={() => users.refetch()}
      testID="team-screen"
    >
      <Col gap={14}>
        <ReadOnlyBanner />
        {limitHit || full ? (
          <PlanLimitBanner
            what="users"
            testID="team-limit-banner"
            message={
              full
                ? `You are using ${usedUsers} of ${maxUsers} users on your plan. Upgrade, or deactivate someone to add a new user.`
                : undefined
            }
          />
        ) : null}
        {!canManagers ? (
          <Text variant="caption" tone="muted">
            As a manager you can add and manage staff accounts. Managers and the
            owner are managed by the owner.
          </Text>
        ) : null}
        <DataList<TeamUser>
          testID="team-list"
          rows={users.data}
          columns={columns}
          keyOf={(u) => u.id}
          loading={users.isLoading}
          error={users.error}
          onRetry={() => users.refetch()}
          empty={
            <EmptyState
              icon={Users}
              title="Just you so far"
              message="Add staff for each counter so every booking shows who made it."
              action={addButton}
            />
          }
        />
      </Col>

      <AddUserDialog
        visible={adding}
        onClose={() => setAdding(false)}
        branches={branches}
        onLimit={() => setLimitHit(true)}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        branches={branches}
      />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
      />
    </Screen>
  );
}
