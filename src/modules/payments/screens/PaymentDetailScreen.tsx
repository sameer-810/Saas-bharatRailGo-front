/** One payment: amount, party, mode, allocations to bookings, advance; edit / delete. */
import React, { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  Divider,
  EmptyState,
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
import { useTheme } from "@shared/useTheme";
import { useApiGet, useApiList, useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { formatDate, formatDateTime } from "@shared/lib/format";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { useAppNav, useParams } from "@navigation/useAppNav";
import {
  PaymentEditDialog,
  PAYMENT_INVALIDATE,
} from "../components/PaymentEditDialog";
import { consignmentLabel, round2 } from "../lib";
import {
  PAYMENT_MODE_LABEL,
  partyId,
  partyName,
  type ConsignmentLite,
  type Payment,
} from "../types";

export function PaymentDetailScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { id } = useParams<{ id: string }>();
  const canDelete = useCan("records.delete");
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);

  const q = useApiGet<Payment>(["payments", id], id ? `/payments/${id}` : null);
  const p = q.data;
  const pid = p ? partyId(p.party) : undefined;

  // Allocations only carry the consignment id, so look the rows up from the party's bookings.
  const partyBookings = useApiList<ConsignmentLite>(
    "consignments",
    "/consignments",
    { party: pid, limit: 1000 },
    { enabled: !!pid && (p?.allocations.length ?? 0) > 0 },
  );
  const lookup = useMemo(
    () => new Map((partyBookings.data?.items || []).map((c) => [c.id, c])),
    [partyBookings.data],
  );

  const remove = useApiMutation<unknown, void>("delete", `/payments/${id}`, {
    invalidate: PAYMENT_INVALIDATE,
  });

  const onDelete = async () => {
    if (!p) return;
    const ok = await confirm({
      title: "Delete this payment?",
      message: `This reverses its allocations: the ${p.allocations.length} booking${
        p.allocations.length === 1 ? "" : "s"
      } it paid off go back to owing the money, and any advance is removed. This cannot be undone.`,
      confirmLabel: "Delete payment",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync();
      toast.success("Payment deleted");
      nav.navigate("Payments");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  if (q.isLoading) {
    return (
      <Screen
        title="Payment"
        back
        backTo="Payments"
        testID="payment-detail-screen"
      >
        <LoadingBlock />
      </Screen>
    );
  }
  if (q.error || !p) {
    return (
      <Screen
        title="Payment"
        back
        backTo="Payments"
        testID="payment-detail-screen"
      >
        <ErrorState
          message={q.error ? apiErrorMessage(q.error) : "Payment not found"}
          onRetry={() => q.refetch()}
        />
      </Screen>
    );
  }

  const allocated = round2(p.amount - (p.unallocatedAmount || 0));
  const receivedBy = p.receivedBy
    ? typeof p.receivedBy === "string"
      ? p.receivedBy
      : p.receivedBy.name
    : "—";

  return (
    <Screen
      title="Payment"
      subtitle={`${formatDate(p.date)} · ${partyName(p.party)}`}
      back
      backTo="Payments"
      testID="payment-detail-screen"
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      maxWidth={960}
      actions={
        <>
          <Button
            title="Edit"
            icon={Pencil}
            variant="secondary"
            onPress={() => setEditing(true)}
            disabled={readOnly}
            testID="payment-edit"
          />
          {canDelete ? (
            <Button
              title="Delete"
              icon={Trash2}
              variant="danger"
              onPress={onDelete}
              loading={remove.isPending}
              disabled={readOnly}
              testID="payment-delete"
            />
          ) : null}
        </>
      }
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only"
            message="Your subscription has expired, so this payment cannot be changed."
          />
        ) : null}

        <Card>
          <Row justify="space-between" align="flex-start" wrap gap={12}>
            <Col gap={4}>
              <Text variant="overline" tone="muted">
                Amount received
              </Text>
              <Money value={p.amount} variant="display" />
            </Col>
            <Col gap={4} align="flex-end">
              <Text variant="caption" tone="faint">
                Allocated
              </Text>
              <Money value={allocated} variant="bodyStrong" tone="success" />
              {p.unallocatedAmount > 0 ? (
                <>
                  <Text variant="caption" tone="faint">
                    Advance
                  </Text>
                  <Money
                    value={p.unallocatedAmount}
                    variant="bodyStrong"
                    tone="accent"
                  />
                </>
              ) : null}
            </Col>
          </Row>
          <Divider style={{ marginVertical: 12 }} />
          <KeyValue
            items={[
              [
                "Party",
                pid ? (
                  <Text
                    tone="accent"
                    onPress={() => nav.navigate("PartyDetail", { id: pid })}
                    testID="payment-party-link"
                  >
                    {partyName(p.party)}
                  </Text>
                ) : (
                  <Text>{partyName(p.party)}</Text>
                ),
              ],
              ["Date", formatDate(p.date)],
              ["Mode", PAYMENT_MODE_LABEL[p.mode] ?? p.mode],
              [
                "Reference no.",
                <Text key="ref" style={{ fontFamily: t.fonts.mono }}>
                  {p.referenceNumber || "—"}
                </Text>,
              ],
              ["Received by", receivedBy],
              ["Recorded", formatDateTime(p.createdAt)],
            ]}
          />
          {p.notes ? (
            <Col gap={2} style={{ marginTop: 4 }}>
              <Text variant="caption" tone="faint">
                Notes
              </Text>
              <Text>{p.notes}</Text>
            </Col>
          ) : null}
        </Card>

        <Card>
          <SectionHeader
            title={`Allocated to ${p.allocations.length} booking${p.allocations.length === 1 ? "" : "s"}`}
          />
          {p.allocations.length === 0 ? (
            <EmptyState
              title="Not allocated"
              message="The party had no open to-pay or on-bill bookings when this was recorded, so the whole amount is an advance."
            />
          ) : (
            <Col gap={0} testID="payment-allocations">
              {p.allocations.map((a, i) => {
                const c = lookup.get(a.consignment);
                return (
                  <Row
                    key={a.consignment}
                    justify="space-between"
                    gap={12}
                    style={{
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: t.c.border,
                    }}
                  >
                    <Col gap={4} flex={1}>
                      <Text
                        tone="accent"
                        onPress={() =>
                          nav.navigate("BookingDetail", { id: a.consignment })
                        }
                        testID={`payment-alloc-${a.consignment}`}
                        numberOfLines={1}
                      >
                        {c
                          ? consignmentLabel(c)
                          : `Booking …${a.consignment.slice(-6)}`}
                      </Text>
                      {c ? (
                        <Row gap={8} wrap>
                          <StatusPill status={c.paymentStatus} />
                          {c.railwayReceiptNumber ? (
                            <Text
                              variant="caption"
                              tone="faint"
                              style={{ fontFamily: t.fonts.mono }}
                            >
                              RR {c.railwayReceiptNumber}
                            </Text>
                          ) : null}
                          {c.balanceDue > 0 ? (
                            <Text variant="caption" tone="warning">
                              <Money
                                value={c.balanceDue}
                                variant="caption"
                                tone="warning"
                              />{" "}
                              still due
                            </Text>
                          ) : null}
                        </Row>
                      ) : null}
                    </Col>
                    <Money value={a.amount} variant="bodyStrong" />
                  </Row>
                );
              })}
            </Col>
          )}
          {p.unallocatedAmount > 0 ? (
            <>
              <Divider style={{ marginVertical: 8 }} />
              <Row justify="space-between" testID="payment-advance">
                <Col gap={2} flex={1}>
                  <Text variant="bodyStrong">Unallocated advance</Text>
                  <Text variant="caption" tone="faint">
                    More than the party owed at the time. It stays as a credit
                    on this payment.
                  </Text>
                </Col>
                <Money
                  value={p.unallocatedAmount}
                  variant="bodyStrong"
                  tone="accent"
                />
              </Row>
            </>
          ) : null}
        </Card>
      </Col>

      <PaymentEditDialog
        payment={p}
        visible={editing}
        onClose={() => setEditing(false)}
      />
    </Screen>
  );
}
