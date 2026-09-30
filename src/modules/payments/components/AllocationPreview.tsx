/**
 * Shows a party's open balance and how a payment amount will be split across
 * the open consignments (oldest first). Client-side preview only; the server
 * does the real allocation on save.
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import { useTheme } from "@shared/useTheme";
import {
  Badge,
  Card,
  Col,
  Divider,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Money,
  Row,
  StatusPill,
  Text,
} from "@shared/ui";
import { consignmentLabel, fifoPreview } from "../lib";
import type { ConsignmentLite } from "../types";

export function AllocationPreview({
  amount,
  open,
  totalDue,
  loading,
  error,
  onRetry,
  onOpenConsignment,
}: {
  amount: number | undefined;
  open: ConsignmentLite[];
  totalDue: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onOpenConsignment?: (id: string) => void;
}) {
  const t = useTheme();
  const preview = useMemo(() => fifoPreview(amount || 0, open), [amount, open]);

  if (error)
    return (
      <ErrorState
        message="Could not load this party's open bookings."
        onRetry={onRetry}
      />
    );
  if (loading) return <LoadingBlock rows={3} />;

  return (
    <Card testID="payment-preview">
      <Row justify="space-between" align="flex-start" wrap gap={12}>
        <Col gap={2}>
          <Text variant="overline" tone="muted">
            Open balance
          </Text>
          <View testID="payment-open-balance">
            <Money value={totalDue} variant="h2" />
          </View>
          <Text variant="caption" tone="faint">
            {open.length} open to-pay / on-bill booking
            {open.length === 1 ? "" : "s"}
          </Text>
        </Col>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: t.radius.pill,
            backgroundColor: t.c.surfaceAlt,
          }}
        >
          <Text variant="label" tone="muted">
            Preview
          </Text>
        </View>
      </Row>

      <Divider style={{ marginVertical: 12 }} />

      {open.length === 0 ? (
        <EmptyState
          title="Nothing open for this party"
          message="The whole amount will be kept as an advance and used against their next bookings."
        />
      ) : (
        <Col gap={0}>
          <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
            How this payment will be split (oldest first). The server confirms
            the final split when you save.
          </Text>
          {preview.lines.map((l, i) => (
            <Row
              key={l.consignment.id}
              testID={`payment-preview-line-${l.consignment.id}`}
              justify="space-between"
              gap={12}
              style={{
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.c.border,
                opacity: l.applied > 0 ? 1 : 0.6,
              }}
            >
              <Col gap={2} flex={1}>
                <Text
                  onPress={
                    onOpenConsignment
                      ? () => onOpenConsignment(l.consignment.id)
                      : undefined
                  }
                  numberOfLines={1}
                >
                  {consignmentLabel(l.consignment)}
                </Text>
                <Row gap={8}>
                  <StatusPill status={l.consignment.paymentStatus} />
                  <Text variant="caption" tone="faint">
                    Due <Money value={l.due} variant="caption" tone="faint" />
                  </Text>
                </Row>
              </Col>
              <Col gap={2} align="flex-end">
                <Money
                  value={l.applied}
                  tone={l.applied > 0 ? "success" : "faint"}
                />
                {l.applied > 0 && l.remainingDue > 0 ? (
                  <Text variant="caption" tone="warning">
                    <Money
                      value={l.remainingDue}
                      variant="caption"
                      tone="warning"
                    />{" "}
                    still due
                  </Text>
                ) : l.applied > 0 ? (
                  <Text variant="caption" tone="success">
                    Cleared
                  </Text>
                ) : null}
              </Col>
            </Row>
          ))}
        </Col>
      )}

      {preview.advance > 0 ? (
        <Row
          justify="space-between"
          style={{ marginTop: 12 }}
          testID="payment-preview-advance"
        >
          <Row gap={6}>
            <Text variant="bodyStrong">Advance (unallocated)</Text>
            <Badge>+</Badge>
          </Row>
          <Money value={preview.advance} variant="bodyStrong" tone="accent" />
        </Row>
      ) : null}
    </Card>
  );
}
