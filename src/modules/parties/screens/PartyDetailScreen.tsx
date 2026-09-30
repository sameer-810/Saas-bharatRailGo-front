/** Party detail: contact actions, info, quick actions and the running-balance ledger. */
import React from "react";
import { Linking } from "react-native";
import {
  FilePlus2,
  FileText,
  IndianRupee,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react-native";
import {
  Button,
  Card,
  Col,
  ErrorState,
  IconButton,
  KeyValue,
  LoadingBlock,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  Text,
  confirm,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useBusinessProfile } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatDate, formatMoney } from "@shared/lib/format";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { Balance, LedgerTable } from "../components/LedgerTable";
import { PartyPrivacyCard } from "../components/PartyPrivacyCard";
import {
  paymentModeLabel,
  waNumber,
  type Party,
  type PartyLedger,
} from "../types";

export function PartyDetailScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  const { id } = useParams<{ id: string }>();
  const canDelete = useCan("records.delete");
  const canPrivacy = useCan("privacy.manage");
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();

  const one = useApiGet<Party>(["parties", id], id ? `/parties/${id}` : null);
  const ledger = useApiGet<PartyLedger>(
    ["parties", id, "ledger"],
    id ? `/parties/${id}/ledger` : null,
  );
  const remove = useApiMutation<
    { consignmentsRetained?: number },
    { id: string }
  >("delete", (v) => `/parties/${v.id}`, {
    invalidate: ["parties", "dashboard", "reports"],
  });

  const party = one.data;
  const outstanding = ledger.data?.totalOutstanding ?? 0;
  const rows = ledger.data?.ledger;
  const billed = (rows || [])
    .filter((r) => r.type === "consignment")
    .reduce((a, r) => a + r.debit, 0);
  const received = (rows || [])
    .filter((r) => r.type === "payment")
    .reduce((a, r) => a + r.credit, 0);

  const open = async (url: string, fail: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(fail);
    }
  };

  const onCall = (mobile?: string) => {
    const d = String(mobile || "").replace(/[^\d+]/g, "");
    if (d) open(`tel:${d}`, "Could not start the call");
  };

  const onWhatsApp = () => {
    if (!party) return;
    const phone = waNumber(party.mobile) || waNumber(party.alternateMobile);
    const biz = profile.data?.businessName;
    const msg =
      outstanding > 0
        ? `Dear ${party.name}, your outstanding balance${biz ? ` with ${biz}` : ""} is ${formatMoney(outstanding)} as of ${formatDate(new Date())}. Kindly arrange payment. Thank you.`
        : `Dear ${party.name},${biz ? ` greetings from ${biz}.` : ""}`;
    open(
      `https://wa.me/${phone || ""}?text=${encodeURIComponent(msg)}`,
      "Could not open WhatsApp",
    );
  };

  const onDelete = async () => {
    if (!party) return;
    const ok = await confirm({
      title: `Delete ${party.name}?`,
      message:
        "The party is deactivated and hidden from lists. Their past bookings and payments are kept.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await remove.mutateAsync({ id: party.id });
      const kept = res?.consignmentsRetained;
      toast.success(
        kept
          ? `Party deactivated · ${kept} bookings kept`
          : "Party deactivated",
      );
      nav.navigate("Parties");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (one.error) {
    return (
      <Screen title="Party" back backTo="Parties" testID="party-detail-screen">
        <ErrorState
          message={apiErrorMessage(one.error)}
          onRetry={() => one.refetch()}
        />
      </Screen>
    );
  }
  if (!party) {
    return (
      <Screen title="Party" back backTo="Parties" testID="party-detail-screen">
        <LoadingBlock rows={6} />
      </Screen>
    );
  }

  const quick = [
    {
      key: "booking",
      title: "New booking",
      icon: Package,
      route: "BookingNew" as const,
    },
    {
      key: "bilti",
      title: "New bilti",
      icon: FileText,
      route: "BiltiNew" as const,
    },
    {
      key: "payment",
      title: "Record payment",
      icon: IndianRupee,
      route: "PaymentNew" as const,
    },
    {
      key: "invoice",
      title: "New invoice",
      icon: FilePlus2,
      route: "InvoiceNew" as const,
    },
  ];

  const mono = (v?: string) =>
    v ? (
      <Text style={{ fontFamily: t.fonts.mono }}>{v}</Text>
    ) : (
      <Text tone="faint">—</Text>
    );

  return (
    <Screen
      title={party.name}
      subtitle={
        [party.city, party.state].filter(Boolean).join(", ") || undefined
      }
      back
      backTo="Parties"
      testID="party-detail-screen"
      refreshing={one.isRefetching || ledger.isRefetching}
      onRefresh={() => {
        one.refetch();
        ledger.refetch();
      }}
      actions={
        <>
          {party.mobile ? (
            <Button
              testID="party-call"
              title={isPhone ? "Call" : party.mobile}
              icon={Phone}
              variant="secondary"
              onPress={() => onCall(party.mobile)}
            />
          ) : null}
          <Button
            testID="party-whatsapp"
            title="WhatsApp"
            icon={MessageCircle}
            variant="secondary"
            onPress={onWhatsApp}
          />
          <Button
            testID="party-edit"
            title="Edit"
            icon={Pencil}
            variant="secondary"
            disabled={readOnly}
            onPress={() => nav.navigate("PartyEdit", { id: party.id })}
          />
          {canDelete ? (
            <IconButton
              testID="party-delete"
              icon={Trash2}
              label="Delete party"
              tone="danger"
              onPress={onDelete}
            />
          ) : null}
        </>
      }
    >
      <Col gap={16}>
        <Row gap={12} wrap align="stretch">
          <StatTile
            testID="party-outstanding"
            label="Outstanding"
            value={
              ledger.data ? (
                <Balance value={outstanding} variant="h2" />
              ) : (
                <Text tone="faint">…</Text>
              )
            }
            hint={
              outstanding > 0
                ? "Party owes you"
                : outstanding < 0
                  ? "Advance with you"
                  : "All settled"
            }
          />
          <StatTile
            testID="party-billed"
            label="Booked on account"
            value={formatMoney(billed, { compact: true })}
          />
          <StatTile
            testID="party-received"
            label="Received"
            value={formatMoney(received, { compact: true })}
          />
        </Row>

        <Row gap={8} wrap testID="party-quick-actions">
          {quick.map((q) => (
            <Button
              key={q.key}
              testID={`party-quick-${q.key}`}
              title={q.title}
              icon={q.icon}
              variant={q.key === "payment" ? "primary" : "secondary"}
              size="sm"
              disabled={readOnly}
              onPress={() => nav.navigate(q.route, { partyId: party.id })}
            />
          ))}
        </Row>

        <Card>
          <SectionHeader title="Details" />
          <KeyValue
            items={[
              [
                "Mobile",
                party.mobile ? (
                  <Text
                    key="m"
                    style={{ fontFamily: t.fonts.mono }}
                    onPress={() => onCall(party.mobile)}
                    tone="accent"
                    testID="party-mobile-link"
                  >
                    {party.mobile}
                  </Text>
                ) : (
                  "—"
                ),
              ],
              [
                "Alternate mobile",
                party.alternateMobile ? (
                  <Text
                    key="am"
                    style={{ fontFamily: t.fonts.mono }}
                    onPress={() => onCall(party.alternateMobile)}
                    tone="accent"
                    testID="party-altmobile-link"
                  >
                    {party.alternateMobile}
                  </Text>
                ) : (
                  "—"
                ),
              ],
              ["Email", party.email || "—"],
              ["GSTIN", mono(party.gstin)],
              ["PAN", mono(party.pan)],
              ["Default station", mono(party.defaultStation)],
              ["Payment mode", paymentModeLabel(party.defaultPaymentMode)],
              [
                "Opening balance",
                <Balance key="ob" value={party.openingBalance || 0} />,
              ],
              ["Address", party.address || "—"],
            ]}
          />
        </Card>

        <Col gap={0}>
          <SectionHeader title="Ledger" />
          <LedgerTable
            rows={rows}
            loading={ledger.isLoading}
            error={ledger.error}
            onRetry={() => ledger.refetch()}
            emptyAction={
              <Button
                testID="party-ledger-new-booking"
                title="New booking"
                icon={Package}
                disabled={readOnly}
                onPress={() =>
                  nav.navigate("BookingNew", { partyId: party.id })
                }
              />
            }
          />
        </Col>

        {canPrivacy ? (
          <PartyPrivacyCard party={party} readOnly={readOnly} />
        ) : null}
      </Col>
    </Screen>
  );
}
