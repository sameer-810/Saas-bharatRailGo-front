/* eslint-disable react/jsx-key -- KeyValue takes [label, node] tuples and keys rows by label. */
/** Booking detail — route header, delivery stepper, parcel / route / money sections, actions. */
import React, { useState } from "react";
import { Pressable } from "react-native";
import { FileText, Pencil, ScrollText, Trash2 } from "lucide-react-native";
import {
  Button,
  Card,
  Col,
  ErrorState,
  KeyValue,
  LoadingBlock,
  Money,
  Row,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  confirm,
  toast,
} from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatDate, formatDateTime, formatNumber } from "@shared/lib/format";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { DeliveryStepper } from "../components/DeliveryStepper";
import {
  DELIVERY_LABEL,
  PAYMENT_MODE_LABEL,
  PAYMENT_STATUS_LABEL,
  TYPE_LABEL,
  partyId,
  partyName,
  type Consignment,
  type DeliveryStatus,
} from "../lib/types";

export function BookingDetailScreen() {
  const t = useTheme();
  const { isPhone } = useLayout();
  const nav = useAppNav();
  const { id } = useParams<{ id: string }>();
  const canDelete = useCan("records.delete");
  const readOnly = useReadOnly();
  const one = useApiGet<Consignment>(
    ["consignments", id],
    id ? `/consignments/${id}` : null,
  );
  const c = one.data;
  const [pendingStatus, setPendingStatus] = useState<DeliveryStatus | null>(
    null,
  );

  const setStatus = useApiMutation<
    Consignment,
    { deliveryStatus: DeliveryStatus }
  >("patch", `/consignments/${id}/status`, {
    invalidate: ["consignments", "dashboard", "reports"],
  });
  const remove = useApiMutation<unknown, void>(
    "delete",
    `/consignments/${id}`,
    {
      invalidate: [
        "consignments",
        "parties",
        "dashboard",
        "reports",
        "invoices",
        "payments",
      ],
    },
  );

  const mono = { fontFamily: t.fonts.mono };

  const changeStatus = async (s: DeliveryStatus) => {
    if (s === "returned") {
      const ok = await confirm({
        title: "Mark as returned?",
        message: "Use this when the parcel came back to the booking office.",
        confirmLabel: "Mark returned",
        danger: true,
      });
      if (!ok) return;
    }
    setPendingStatus(s);
    try {
      await setStatus.mutateAsync({ deliveryStatus: s });
      toast.success(`Marked ${DELIVERY_LABEL[s].toLowerCase()}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingStatus(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: "Delete this booking?",
      message:
        "It will be removed from lists, reports and any draft invoice. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(undefined);
      toast.success("Booking deleted");
      nav.navigate("Bookings");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (one.isLoading) {
    return (
      <Screen
        title="Booking"
        back
        backTo="Bookings"
        testID="booking-detail-screen"
      >
        <LoadingBlock rows={6} />
      </Screen>
    );
  }
  if (one.error || !c) {
    return (
      <Screen
        title="Booking"
        back
        backTo="Bookings"
        testID="booking-detail-screen"
      >
        <ErrorState
          message={apiErrorMessage(one.error, "Booking not found")}
          onRetry={one.refetch}
        />
      </Screen>
    );
  }

  const pid = partyId(c);
  const invoice = c.invoice && typeof c.invoice === "object" ? c.invoice : null;
  const invoiceId =
    invoice?.id ?? (typeof c.invoice === "string" ? c.invoice : null);

  return (
    <Screen
      title={partyName(c)}
      subtitle={`${formatDate(c.date)} · ${TYPE_LABEL[c.type] ?? c.type}`}
      back
      backTo="Bookings"
      testID="booking-detail-screen"
      refreshing={one.isRefetching}
      onRefresh={one.refetch}
      actions={
        <>
          <Button
            title="Create bilti"
            variant="secondary"
            icon={ScrollText}
            size={isPhone ? "sm" : "md"}
            disabled={readOnly}
            onPress={() =>
              nav.navigate("BiltiNew", pid ? { partyId: pid } : undefined)
            }
            testID="booking-create-bilti"
          />
          <Button
            title="Edit"
            variant="secondary"
            icon={Pencil}
            size={isPhone ? "sm" : "md"}
            disabled={readOnly}
            onPress={() => nav.navigate("BookingEdit", { id: c.id })}
            testID="booking-edit"
          />
          {canDelete ? (
            <Button
              title="Delete"
              variant="danger"
              icon={Trash2}
              size={isPhone ? "sm" : "md"}
              disabled={readOnly}
              loading={remove.isPending}
              onPress={onDelete}
              testID="booking-delete"
            />
          ) : null}
        </>
      }
    >
      <Col gap={16}>
        {/* Route header */}
        <Card testID="booking-route-card">
          <Col gap={14}>
            <Row justify="space-between" wrap gap={12} align="center">
              <Row gap={10} align="center">
                <Text variant="display" style={mono} testID="booking-route">
                  {c.originStation} → {c.destinationStation}
                </Text>
              </Row>
              <Row gap={6} wrap>
                <StatusPill
                  status={c.paymentStatus}
                  label={PAYMENT_STATUS_LABEL[c.paymentStatus]}
                />
                <StatusPill
                  status={c.deliveryStatus}
                  label={DELIVERY_LABEL[c.deliveryStatus]}
                />
              </Row>
            </Row>
            <Row gap={16} wrap>
              <Text tone="muted" style={mono}>
                {c.packages} pkg · {formatNumber(c.chargeableWeight)} kg
              </Text>
              <Money value={c.totalAmount} variant="h3" />
              <Text tone="muted">
                {PAYMENT_MODE_LABEL[c.paymentMode] ?? c.paymentMode}
              </Text>
            </Row>
            <SectionHeader title="Delivery status" />
            <DeliveryStepper
              value={c.deliveryStatus}
              onChange={changeStatus}
              pending={pendingStatus}
              disabled={readOnly}
            />
          </Col>
        </Card>

        <Card testID="booking-parcel">
          <SectionHeader title="Parcel" />
          <KeyValue
            items={[
              ["Packages", <Text style={mono}>{c.packages}</Text>],
              [
                "Actual weight",
                <Text style={mono}>
                  {c.actualWeight != null
                    ? `${formatNumber(c.actualWeight)} kg`
                    : "—"}
                </Text>,
              ],
              [
                "Chargeable weight",
                <Text
                  style={mono}
                >{`${formatNumber(c.chargeableWeight)} kg`}</Text>,
              ],
              ["Contents", c.contents || "—"],
              ["Type", TYPE_LABEL[c.type] ?? c.type],
              [
                "Class",
                [c.isLease && "Lease", c.isBooking && "Booking"]
                  .filter(Boolean)
                  .join(", ") || "—",
              ],
            ]}
          />
        </Card>

        <Card testID="booking-route-train">
          <SectionHeader title="Route & train" />
          <KeyValue
            items={[
              ["From", <Text style={mono}>{c.originStation}</Text>],
              ["To", <Text style={mono}>{c.destinationStation}</Text>],
              ["Train no.", <Text style={mono}>{c.trainNumber || "—"}</Text>],
              ["Bogie no.", <Text style={mono}>{c.bogieNumber || "—"}</Text>],
              [
                "RR no.",
                <Text style={mono}>{c.railwayReceiptNumber || "—"}</Text>,
              ],
              ...(c.agentName
                ? ([["Agent", c.agentName]] as [string, React.ReactNode][])
                : []),
            ]}
          />
        </Card>

        <Card testID="booking-money">
          <SectionHeader title="Money" />
          <KeyValue
            items={[
              ["Freight", <Money value={c.freightAmount} />],
              ["Reimbursement", <Money value={c.reimbursementAmount} />],
              ["Hamali", <Money value={c.hamaliCharges} />],
              ["Other", <Money value={c.otherCharges} />],
              ["Total", <Money value={c.totalAmount} variant="h3" />],
              [
                "Payment mode",
                PAYMENT_MODE_LABEL[c.paymentMode] ?? c.paymentMode,
              ],
              ["Paid now (at booking)", <Money value={c.directPaid} />],
              ["Amount paid", <Money value={c.amountPaid} tone="success" />],
              [
                "Balance",
                <Money
                  value={c.balanceDue}
                  tone={c.balanceDue > 0 ? "warning" : undefined}
                />,
              ],
              [
                "Payment status",
                <StatusPill
                  status={c.paymentStatus}
                  label={PAYMENT_STATUS_LABEL[c.paymentStatus]}
                />,
              ],
              ["Received by", c.paymentReceiver || "—"],
              [
                "Invoice",
                invoiceId ? (
                  <Pressable
                    testID="booking-invoice-link"
                    accessibilityRole="link"
                    onPress={() =>
                      nav.navigate("InvoiceDetail", { id: invoiceId })
                    }
                  >
                    <Row gap={6}>
                      <FileText size={14} color={t.c.accent} />
                      <Text tone="accent" style={mono}>
                        {invoice?.billNumber || "Open invoice"}
                      </Text>
                      {invoice?.status ? (
                        <StatusPill status={invoice.status} />
                      ) : null}
                    </Row>
                  </Pressable>
                ) : (
                  <Text tone="faint">Not billed yet</Text>
                ),
              ],
            ]}
          />
        </Card>

        {c.notes ? (
          <Card testID="booking-notes">
            <SectionHeader title="Notes" />
            <Text>{c.notes}</Text>
          </Card>
        ) : null}

        <Text variant="caption" tone="faint">
          Created {formatDateTime(c.createdAt)} · Updated{" "}
          {formatDateTime(c.updatedAt)}
        </Text>
      </Col>
    </Screen>
  );
}
