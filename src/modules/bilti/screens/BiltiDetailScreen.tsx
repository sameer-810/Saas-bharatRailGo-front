/** Bilti detail: number on the flap board, delivery stepper, print / WhatsApp / edit / delete. */
import React, { useState } from "react";
import { Linking } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Printer, Trash2 } from "lucide-react-native";
import {
  Banner,
  Board,
  BoardText,
  Button,
  Card,
  Col,
  ErrorState,
  FlapText,
  IconButton,
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
import {
  apiClient,
  apiErrorMessage,
  type Envelope,
} from "@shared/api/apiClient";
import { openPdf } from "@shared/api/files";
import { useBusinessProfile } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatDate, formatDateTime, formatNumber } from "@shared/lib/format";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { StatusStepper } from "../components/StatusStepper";
import {
  STATUS_FLOW,
  STATUS_LABEL,
  biltiNo,
  waNumber,
  type DeliveryStatus,
  type Pod,
  type SmsResult,
} from "../types";

function smsBanner(sms: SmsResult | undefined, status: DeliveryStatus) {
  const label = STATUS_LABEL[status];
  if (!sms)
    return {
      tone: "info" as const,
      title: `Marked ${label}`,
      message: undefined,
    };
  if (sms.attempted && sms.sent) {
    return {
      tone: "success" as const,
      title: `Marked ${label} · SMS sent`,
      message: sms.sentTo?.length
        ? `Sent to ${sms.sentTo.join(", ")}`
        : undefined,
    };
  }
  if (sms.attempted) {
    return {
      tone: "warning" as const,
      title: `Marked ${label} · SMS failed`,
      message: "The status was saved, but the SMS could not be delivered.",
    };
  }
  const why: Record<string, string> = {
    no_template_for_status: "No SMS is sent for this status.",
    sms_disabled: "SMS is not enabled for this account.",
    no_mobile: "No valid mobile number on this bilti.",
  };
  return {
    tone: "info" as const,
    title: `Marked ${label} · SMS skipped`,
    message: why[sms.reason || ""] || sms.reason,
  };
}

export function BiltiDetailScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const qc = useQueryClient();
  const { isPhone } = useLayout();
  const { id } = useParams<{ id: string }>();
  const canDelete = useCan("records.delete");
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();
  const one = useApiGet<Pod>(["pods", id], id ? `/pods/${id}` : null);
  const remove = useApiMutation<unknown, { id: string }>(
    "delete",
    (v) => `/pods/${v.id}`,
    {
      invalidate: ["pods", "dashboard", "reports"],
    },
  );

  const [pending, setPending] = useState<DeliveryStatus | null>(null);
  const [notice, setNotice] = useState<ReturnType<typeof smsBanner> | null>(
    null,
  );
  const [pdfBusy, setPdfBusy] = useState(false);

  const pod = one.data;
  const no = biltiNo(profile.data?.podNumberPrefix, pod?.podNumber);

  const changeStatus = async (next: DeliveryStatus) => {
    if (!pod) return;
    const back =
      next !== "returned" &&
      pod.deliveryStatus !== "returned" &&
      STATUS_FLOW.indexOf(next) < STATUS_FLOW.indexOf(pod.deliveryStatus);
    if (next === "returned" || back) {
      const ok = await confirm({
        title:
          next === "returned"
            ? "Mark as returned?"
            : `Move back to ${STATUS_LABEL[next]}?`,
        message:
          next === "returned"
            ? "Use this when the parcel comes back undelivered."
            : "This moves the bilti to an earlier step.",
        confirmLabel: next === "returned" ? "Mark returned" : "Move back",
        danger: next === "returned",
      });
      if (!ok) return;
    }
    setPending(next);
    setNotice(null);
    try {
      const res = await apiClient.patch<Envelope<Pod>>(
        `/pods/${pod.id}/status`,
        { deliveryStatus: next },
      );
      const sms = (res.data.meta as { sms?: SmsResult } | undefined)?.sms;
      await Promise.all(
        ["pods", "dashboard", "reports"].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
      const b = smsBanner(sms, next);
      setNotice(b);
      toast.success(b.title);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const onPdf = async () => {
    if (!pod) return;
    setPdfBusy(true);
    try {
      await openPdf(
        `/pods/${pod.id}/pdf`,
        `bilti-${no.replace(/[^\w-]+/g, "-")}.pdf`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not open the PDF"));
    } finally {
      setPdfBusy(false);
    }
  };

  const onWhatsApp = async () => {
    if (!pod) return;
    const lines = [
      `Bilti ${no}`,
      `From: ${pod.consignorName} (${pod.originStation})`,
      `To: ${pod.consigneeName}, ${pod.destinationStation}`,
      `Packages: ${pod.packages}`,
      `Status: ${STATUS_LABEL[pod.deliveryStatus]}`,
      pod.railwayReceiptNumber ? `RR: ${pod.railwayReceiptNumber}` : "",
      profile.data?.businessName ? `— ${profile.data.businessName}` : "",
    ].filter(Boolean);
    const phone =
      waNumber(pod.consigneeMobile) || waNumber(pod.consignorMobile);
    const url = `https://wa.me/${phone || ""}?text=${encodeURIComponent(lines.join("\n"))}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error("Could not open WhatsApp");
    }
  };

  const onDelete = async () => {
    if (!pod) return;
    const ok = await confirm({
      title: `Delete bilti ${no}?`,
      message:
        "It will be removed from the register. This cannot be undone from the app.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: pod.id });
      toast.success(`Bilti ${no} deleted`);
      nav.navigate("Bilti");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (one.error) {
    return (
      <Screen title="Bilti" back backTo="Bilti" testID="bilti-detail-screen">
        <ErrorState
          message={apiErrorMessage(one.error)}
          onRetry={() => one.refetch()}
        />
      </Screen>
    );
  }
  if (!pod) {
    return (
      <Screen title="Bilti" back backTo="Bilti" testID="bilti-detail-screen">
        <LoadingBlock rows={6} />
      </Screen>
    );
  }

  const linkedParty =
    pod.party && typeof pod.party === "object" ? pod.party : null;

  return (
    <Screen
      title="Bilti"
      subtitle={`Issued ${formatDate(pod.date)}`}
      back
      backTo="Bilti"
      testID="bilti-detail-screen"
      refreshing={one.isRefetching}
      onRefresh={() => one.refetch()}
      actions={
        <>
          <Button
            testID="bilti-pdf"
            title={isPhone ? "PDF" : "Print / PDF"}
            icon={Printer}
            variant="secondary"
            loading={pdfBusy}
            onPress={onPdf}
          />
          <Button
            testID="bilti-whatsapp"
            title="WhatsApp"
            icon={MessageCircle}
            variant="secondary"
            onPress={onWhatsApp}
          />
          <Button
            testID="bilti-edit"
            title="Edit"
            icon={Pencil}
            variant="secondary"
            disabled={readOnly}
            onPress={() => nav.navigate("BiltiEdit", { id: pod.id })}
          />
          {canDelete ? (
            <IconButton
              testID="bilti-delete"
              icon={Trash2}
              label="Delete bilti"
              tone="danger"
              onPress={onDelete}
            />
          ) : null}
        </>
      }
    >
      <Col gap={16}>
        <Board
          testID="bilti-board"
          title="Bilti no."
          right={<StatusPill status={pod.deliveryStatus} />}
        >
          <Col gap={10}>
            <FlapText
              text={no}
              size={isPhone ? 22 : 30}
              testID="bilti-number"
            />
            <Row gap={16} wrap>
              <BoardText>
                {pod.originStation} → {pod.destinationStation}
              </BoardText>
              <BoardText dim>{pod.packages} PKG</BoardText>
              <BoardText dim>{formatNumber(pod.chargeableWeight)} KG</BoardText>
            </Row>
          </Col>
        </Board>

        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired. Status and edits are locked."
            testID="bilti-detail-readonly"
          />
        ) : null}

        <Card>
          <SectionHeader title="Delivery status" />
          <StatusStepper
            status={pod.deliveryStatus}
            onChange={changeStatus}
            busy={!!pending}
            pending={pending}
            disabled={readOnly}
          />
          {notice ? (
            <Col style={{ marginTop: 12 }}>
              <Banner
                testID="bilti-sms-result"
                tone={notice.tone}
                title={notice.title}
                message={notice.message}
                action={
                  <Button
                    title="Dismiss"
                    size="sm"
                    variant="ghost"
                    testID="bilti-sms-dismiss"
                    onPress={() => setNotice(null)}
                  />
                }
              />
            </Col>
          ) : null}
        </Card>

        <Row gap={16} wrap align="flex-start">
          <Card style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 320 }}>
            <SectionHeader title="Consignor" />
            <Col gap={4}>
              <Text variant="bodyStrong">{pod.consignorName}</Text>
              {pod.consignorMobile ? (
                <Text tone="muted" style={{ fontFamily: t.fonts.mono }}>
                  {pod.consignorMobile}
                </Text>
              ) : null}
              {pod.consignorAddress ? (
                <Text tone="muted">{pod.consignorAddress}</Text>
              ) : null}
              {linkedParty ? (
                <Button
                  testID="bilti-party-link"
                  title={`Party: ${linkedParty.name}`}
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    nav.navigate("PartyDetail", { id: linkedParty.id })
                  }
                />
              ) : null}
            </Col>
          </Card>
          <Card style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 320 }}>
            <SectionHeader title="Consignee" />
            <Col gap={4}>
              <Text variant="bodyStrong">{pod.consigneeName}</Text>
              {pod.consigneeMobile ? (
                <Text tone="muted" style={{ fontFamily: t.fonts.mono }}>
                  {pod.consigneeMobile}
                </Text>
              ) : null}
              {pod.consigneeAddress ? (
                <Text tone="muted">{pod.consigneeAddress}</Text>
              ) : null}
            </Col>
          </Card>
        </Row>

        <Card>
          <SectionHeader title="Parcel" />
          <KeyValue
            items={[
              [
                "Packages",
                <Text key="p" style={{ fontFamily: t.fonts.mono }}>
                  {pod.packages}
                </Text>,
              ],
              [
                "Actual weight",
                pod.actualWeight != null
                  ? `${formatNumber(pod.actualWeight)} kg`
                  : "—",
              ],
              ["Chargeable weight", `${formatNumber(pod.chargeableWeight)} kg`],
              ["Contents", pod.contents || "—"],
              ["Given name", pod.givenName || "—"],
              [
                "RR number",
                <Text key="rr" style={{ fontFamily: t.fonts.mono }}>
                  {pod.railwayReceiptNumber || "—"}
                </Text>,
              ],
              [
                "Origin",
                <Text key="o" style={{ fontFamily: t.fonts.mono }}>
                  {pod.originStation}
                </Text>,
              ],
              [
                "Destination",
                <Text key="d" style={{ fontFamily: t.fonts.mono }}>
                  {pod.destinationStation}
                </Text>,
              ],
              ["Loaded on", pod.loadedOn ? formatDateTime(pod.loadedOn) : "—"],
              [
                "Delivered on",
                pod.deliveredOn ? formatDateTime(pod.deliveredOn) : "—",
              ],
            ]}
          />
        </Card>

        <Card>
          <SectionHeader title="Charges" />
          <Col gap={8}>
            {[
              ["Paid", pod.paidAmount],
              ["To pay", pod.toPayAmount],
              ["Other charges", pod.otherCharges],
            ].map(([label, v]) => (
              <Row key={label as string} justify="space-between">
                <Text tone="muted">{label as string}</Text>
                <Money value={v as number} />
              </Row>
            ))}
            <Row
              justify="space-between"
              style={{
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: t.c.border,
              }}
            >
              <Text variant="bodyStrong">Total</Text>
              <Money value={pod.totalAmount} variant="h3" />
            </Row>
          </Col>
        </Card>

        {pod.notes ? (
          <Card>
            <SectionHeader title="Notes" />
            <Text>{pod.notes}</Text>
          </Card>
        ) : null}

        <Text variant="caption" tone="faint">
          Created {formatDateTime(pod.createdAt)} · Updated{" "}
          {formatDateTime(pod.updatedAt)}
        </Text>
      </Col>
    </Screen>
  );
}
