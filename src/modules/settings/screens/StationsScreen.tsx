/** Station master — searchable list; owner/manager add, edit and (de)activate. */
import React, { useState } from "react";
import { View } from "react-native";
import { MapPin, Pencil, Plus, Power } from "lucide-react-native";
import { useTheme } from "@shared/useTheme";
import {
  Button,
  Col,
  DataList,
  Dialog,
  EmptyState,
  IconButton,
  Row,
  Screen,
  SearchInput,
  StatusPill,
  Text,
  TextField,
  Toggle,
  confirm,
  toast,
  type Column,
} from "@shared/ui";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import type { Station } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { useDebounced } from "@shared/hooks/useDebounced";
import { ReadOnlyBanner } from "../components/common";

const CODE_RX = /^[A-Z0-9]{1,6}$/;

function StationDialog({
  station,
  visible,
  onClose,
}: {
  station: Station | null;
  visible: boolean;
  onClose: () => void;
}) {
  const isEdit = !!station;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [stateName, setStateName] = useState("");
  const [touched, setTouched] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = visible ? station?.id ?? "new" : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setCode(station?.code || "");
    setName(station?.name || "");
    setStateName(station?.state || "");
    setTouched(false);
  }

  const create = useApiMutation<Station, { code: string; name: string; state?: string }>("post", "/stations", {
    invalidate: ["stations"],
  });
  const update = useApiMutation<Station, { id: string; name: string; state?: string }>("patch", (v) => `/stations/${v.id}`, {
    invalidate: ["stations"],
    body: ({ name: n, state }) => ({ name: n, state }),
  });

  const codeErr = !isEdit && touched && !CODE_RX.test(code) ? "1–6 letters or digits, e.g. NDLS" : undefined;
  const nameErr = touched && name.trim().length < 2 ? "Enter the station name" : undefined;

  const save = async () => {
    setTouched(true);
    if ((!isEdit && !CODE_RX.test(code)) || name.trim().length < 2) return;
    try {
      if (station) {
        await update.mutateAsync({ id: station.id, name: name.trim(), state: stateName.trim() || undefined });
        toast.success("Station updated");
      } else {
        await create.mutateAsync({ code, name: name.trim(), state: stateName.trim() || undefined });
        toast.success(`Station ${code} added`);
      }
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={isEdit ? `Edit ${station?.code}` : "Add station"}
      width={440}
      testID="station-dialog"
      footer={
        <>
          <Button testID="station-cancel" title="Cancel" variant="secondary" onPress={onClose} />
          <Button testID="station-save" title={isEdit ? "Save" : "Add station"} loading={create.isPending || update.isPending} onPress={save} />
        </>
      }
    >
      <TextField
        testID="station-code"
        label="Station code"
        value={code}
        onChangeText={(s) => setCode(s.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        autoCapitalize="characters"
        mono
        maxLength={6}
        editable={!isEdit}
        hint={isEdit ? "The code cannot be changed." : "Indian Railways code, e.g. BCT, NDLS"}
        error={codeErr}
      />
      <TextField testID="station-name" label="Name" value={name} onChangeText={setName} error={nameErr} placeholder="e.g. Mumbai Central" />
      <TextField testID="station-state" label="State" value={stateName} onChangeText={setStateName} placeholder="e.g. Maharashtra" />
    </Dialog>
  );
}

export function StationsScreen() {
  const t = useTheme();
  const canEdit = useCan("masters.manage");
  const readOnly = useReadOnly();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const q = useDebounced(search);
  const list = useApiGet<Station[]>(["stations", "list"], "/stations", {
    search: q || undefined,
    includeInactive: canEdit && showInactive ? true : undefined,
  });
  const [dialog, setDialog] = useState<{ station: Station | null } | null>(null);

  const toggle = useApiMutation<Station, { id: string; isActive: boolean }>("patch", (v) => `/stations/${v.id}`, {
    invalidate: ["stations"],
    body: (v) => ({ isActive: v.isActive }),
  });

  const onToggle = async (s: Station) => {
    if (s.isActive) {
      const ok = await confirm({
        title: `Deactivate ${s.code}?`,
        message: "It will no longer be offered on new bookings. Old bookings keep it.",
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await toggle.mutateAsync({ id: s.id, isActive: !s.isActive });
      toast.success(s.isActive ? `${s.code} deactivated` : `${s.code} activated`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const editable = canEdit && !readOnly;
  const columns: Column<Station>[] = [
    {
      key: "code",
      title: "Code",
      flex: 0.8,
      render: (s) => (
        <Text variant="mono" weight="semibold" style={{ fontFamily: t.fonts.monoBold }}>
          {s.code}
        </Text>
      ),
    },
    { key: "name", title: "Name", flex: 2, render: (s) => <Text>{s.name}</Text> },
    { key: "state", title: "State", flex: 1.4, render: (s) => <Text tone="muted">{s.state || "—"}</Text> },
    {
      key: "status",
      title: "Status",
      render: (s) => <StatusPill status={s.isActive ? "active" : "inactive"} label={s.isActive ? "Active" : "Inactive"} />,
    },
  ];
  if (editable) {
    columns.push({
      key: "actions",
      title: "",
      align: "right",
      render: (s) => (
        <Row gap={0}>
          <IconButton testID={`station-edit-${s.code}`} icon={Pencil} label="Edit station" onPress={() => setDialog({ station: s })} />
          <IconButton
            testID={`station-toggle-${s.code}`}
            icon={Power}
            label={s.isActive ? "Deactivate" : "Activate"}
            tone={s.isActive ? "danger" : "accent"}
            onPress={() => onToggle(s)}
          />
        </Row>
      ),
    });
  }

  const addButton = editable ? (
    <Button testID="station-add" title="Add station" icon={Plus} onPress={() => setDialog({ station: null })} />
  ) : null;

  return (
    <Screen
      title="Stations"
      subtitle={canEdit ? "Station codes offered on bookings, branches and rates." : "Station codes (view only)."}
      back
      backTo="Settings"
      actions={addButton}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
      testID="stations-screen"
    >
      <Col gap={14}>
        <ReadOnlyBanner />
        <Row wrap gap={12} align="center">
          <View style={{ flexGrow: 1, flexBasis: 260 }}>
            <SearchInput testID="station-search" value={search} onChangeText={setSearch} placeholder="Search code or name" />
          </View>
          {canEdit ? (
            <View style={{ minWidth: 200 }}>
              <Toggle testID="station-show-inactive" label="Show inactive" value={showInactive} onChange={setShowInactive} />
            </View>
          ) : null}
        </Row>
        {list.data ? (
          <Text variant="caption" tone="faint" testID="station-count">
            {list.data.length} station{list.data.length === 1 ? "" : "s"}
          </Text>
        ) : null}
        <DataList<Station>
          testID="station-list"
          rows={list.data}
          columns={columns}
          keyOf={(s) => s.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => list.refetch()}
          empty={
            <EmptyState
              icon={MapPin}
              title={q ? `No station matches “${q}”` : "No stations yet"}
              message={editable ? "Add the stations you book parcels to." : undefined}
              action={addButton}
            />
          }
        />
      </Col>
      {editable ? <StationDialog visible={!!dialog} station={dialog?.station ?? null} onClose={() => setDialog(null)} /> : null}
    </Screen>
  );
}
