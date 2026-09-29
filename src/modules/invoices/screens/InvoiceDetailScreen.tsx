/** One GST invoice: header, booking lines, Pure Agent totals, and status actions. */
import React, { useState } from "react";
import { Ban, CheckCircle2, FileDown, Pencil, Plus, Send, Trash2, X } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  DataList,
  Divider,
  ErrorState,
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
  type Column,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { openPdf } from "@shared/api/files";
import { useBusinessProfile } from "@shared/api/lookups";
import { formatDate, formatDateTime } from "@shared/lib/format";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { AddConsignmentsDialog } from "../components/AddConsignmentsDialog";
import { InvoiceEditDialog } from "../components/InvoiceEditDialog";
import { TotalsBlock } from "../components/TotalsBlock";
import { routeLabel, serviceOf, type Totals } from "../lib";
import {
  INVOICE_INVALIDATE,
  invoicePartyId,
  invoicePartyName,
  type Invoice,
  type InvoiceConsignment,
} from "../types";

export function InvoiceDetailScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { id } = useParams<{ id: string }>();
  const canDelete = useCan("records.delete");
  const readOnly = useReadOnly();
  const profile = useBusinessProfile();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const q = useApiGet<Invoice>(["invoices", id], id ? `/invoices/${id}` : null);
  const inv = q.data;

  const statusOpts = { invalidate: INVOICE_INVALIDATE, body: () => ({}) };
  const finalize = useApiMutation<Invoice, void>("post", `/invoices/${id}/finalize`, statusOpts);
  const markPaid = useApiMutation<Invoice, void>("post", `/invoices/${id}/mark-paid`, statusOpts);
  const cancel = useApiMutation<Invoice, void>("post", `/invoices/${id}/cancel`, statusOpts);
  const removeLine = useApiMutation<Invoice, { cid: string }>(
    "delete",
    (v) => `/invoices/${id}/consignments/${v.cid}`,
    { invalidate: INVOICE_INVALIDATE },
  );
  const remove = useApiMutation<unknown, void>("delete", `/invoices/${id}`, { invalidate: INVOICE_INVALIDATE });

  if (q.isLoading) {
    return (
      <Screen title="Invoice" back backTo="Invoices" testID="invoice-detail-screen">
        <LoadingBlock />
      </Screen>
    );
  }
  if (q.error || !inv) {
    return (
      <Screen title="Invoice" back backTo="Invoices" testID="invoice-detail-screen">
        <ErrorState message={q.error ? apiErrorMessage(q.error) : "Invoice not found"} onRetry={() => q.refetch()} />
      </Screen>
    );
  }

  const lines = inv.consignments.filter((c): c is InvoiceConsignment => typeof c === "object" && c !== null);
  const isDraft = inv.status === "draft";
  const isSent = inv.status === "sent";
  const pid = invoicePartyId(inv);
  const mono = { fontFamily: t.fonts.mono };

  const run = async (
    m: { mutateAsync: (v: void) => Promise<Invoice> },
    opts: { title: string; message: string; confirmLabel: string; danger?: boolean; done: string },
  ) => {
    const ok = await confirm({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel, danger: opts.danger });
    if (!ok) return;
    try {
      await m.mutateAsync();
      toast.success(opts.done);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onFinalize = () =>
    run(finalize, {
      title: `Finalize bill ${inv.billNumber}?`,
      message:
        "Totals are recomputed and locked, and the invoice moves to Sent. You can no longer edit rates or change its bookings.",
      confirmLabel: "Finalize",
      done: "Invoice finalized",
    });
  const onMarkPaid = () =>
    run(markPaid, {
      title: `Mark bill ${inv.billNumber} as paid?`,
      message: `All ${lines.length} booking${lines.length === 1 ? "" : "s"} on this bill will be marked settled with no balance due.`,
      confirmLabel: "Mark paid",
      done: "Invoice marked as paid",
    });
  const onCancel = () =>
    run(cancel, {
      title: `Cancel bill ${inv.billNumber}?`,
      message: "The bill is voided and its bookings are released so they can be put on another invoice. This cannot be undone.",
      confirmLabel: "Cancel invoice",
      danger: true,
      done: "Invoice cancelled",
    });

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete draft ${inv.billNumber}?`,
      message: "The draft is removed and its bookings become available to bill again.",
      confirmLabel: "Delete draft",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync();
      toast.success("Draft deleted");
      nav.navigate("Invoices");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onRemoveLine = async (c: InvoiceConsignment) => {
    if (lines.length <= 1) {
      toast.error("An invoice must keep at least one booking. Delete the draft instead.");
      return;
    }
    const ok = await confirm({
      title: "Remove this booking?",
      message: `${formatDate(c.date)} · ${routeLabel(c)} goes back to the un-invoiced pool and the totals are recomputed.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeLine.mutateAsync({ cid: c.id });
      toast.success("Booking removed from invoice");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onPdf = async () => {
    setPdfBusy(true);
    try {
      await openPdf(`/invoices/${inv.id}/pdf`, `invoice-${inv.billNumber}.pdf`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not open the PDF"));
    } finally {
      setPdfBusy(false);
    }
  };

  const totals: Totals = {
    serviceSubtotal: inv.serviceSubtotal,
    reimbursementSubtotal: inv.reimbursementSubtotal,
    cgstRate: inv.cgstRate,
    sgstRate: inv.sgstRate,
    igstRate: inv.igstRate,
    cgstAmount: inv.cgstAmount,
    sgstAmount: inv.sgstAmount,
    igstAmount: inv.igstAmount,
    grossTotal: inv.grossTotal,
  };

  const columns: Column<InvoiceConsignment>[] = [
    {
      key: "date",
      title: "Booking",
      flex: 1.6,
      render: (c) => (
        <Col gap={0}>
          <Text tone="accent" onPress={() => nav.navigate("BookingDetail", { id: c.id })} testID={`invoice-line-link-${c.id}`}>
            {formatDate(c.date)}
          </Text>
          <Text variant="caption" tone="muted" style={mono}>
            {routeLabel(c)}
          </Text>
        </Col>
      ),
    },
    {
      key: "rr",
      title: "RR no.",
      flex: 1,
      hideOnPhone: true,
      render: (c) => (
        <Text style={mono} tone={c.railwayReceiptNumber ? "default" : "faint"}>
          {c.railwayReceiptNumber || "—"}
        </Text>
      ),
    },
    { key: "pkg", title: "Pkgs", flex: 0.5, align: "right", render: (c) => <Text style={mono}>{c.packages ?? "—"}</Text> },
    {
      key: "reimb",
      title: "Reimb.",
      flex: 0.9,
      align: "right",
      render: (c) => <Money value={c.reimbursementAmount} tone="muted" />,
    },
    { key: "svc", title: "Service", flex: 0.9, align: "right", render: (c) => <Money value={serviceOf(c)} /> },
    {
      key: "total",
      title: "Total",
      flex: 0.9,
      align: "right",
      hideOnPhone: true,
      render: (c) => <Money value={c.totalAmount} variant="bodyStrong" />,
    },
  ];
  const canEditLines = isDraft && !readOnly;
  const removeButton = (c: InvoiceConsignment) => (
    <IconButton
      icon={X}
      label="Remove booking"
      tone="danger"
      size={32}
      onPress={() => onRemoveLine(c)}
      testID={`invoice-line-remove-${c.id}`}
    />
  );
  if (canEditLines) {
    columns.push({ key: "remove", title: "", flex: 0.4, align: "right", hideOnPhone: true, render: removeButton });
  }

  const actions = (
    <>
      <Button title="PDF" icon={FileDown} variant="secondary" onPress={onPdf} loading={pdfBusy} testID="invoice-pdf" />
      {isDraft ? (
        <>
          <Button title="Edit" icon={Pencil} variant="secondary" onPress={() => setEditing(true)} disabled={readOnly} testID="invoice-edit" />
          <Button title="Finalize" icon={Send} onPress={onFinalize} loading={finalize.isPending} disabled={readOnly} testID="invoice-finalize" />
          {canDelete ? (
            <Button title="Delete" icon={Trash2} variant="danger" onPress={onDelete} loading={remove.isPending} disabled={readOnly} testID="invoice-delete" />
          ) : null}
        </>
      ) : null}
      {isSent ? (
        <>
          <Button title="Mark paid" icon={CheckCircle2} onPress={onMarkPaid} loading={markPaid.isPending} disabled={readOnly} testID="invoice-mark-paid" />
          <Button title="Cancel invoice" icon={Ban} variant="danger" onPress={onCancel} loading={cancel.isPending} disabled={readOnly} testID="invoice-cancel" />
        </>
      ) : null}
    </>
  );

  const snap = inv.partySnapshot || {};

  return (
    <Screen
      title={`Bill ${inv.billNumber || ""}`}
      subtitle={`${invoicePartyName(inv)} · ${formatDate(inv.date)}`}
      back
      backTo="Invoices"
      testID="invoice-detail-screen"
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      actions={actions}
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner tone="warning" title="Read-only" message="Your subscription has expired, so this invoice cannot be changed. You can still open the PDF." />
        ) : null}
        {isDraft ? (
          <Banner
            tone="info"
            title="Draft"
            message="You can still add or remove bookings and change the rates. Finalize it to lock the totals before sending it to the party."
            testID="invoice-draft-banner"
          />
        ) : null}
        {inv.status === "cancelled" ? (
          <Banner tone="danger" title="Cancelled" message="This bill is void. Its bookings were released and can be billed again." />
        ) : null}

        <Card>
          <Row justify="space-between" align="flex-start" wrap gap={12}>
            <Col gap={4}>
              <Text variant="overline" tone="muted">
                Tax invoice
              </Text>
              <Text variant="h1" style={mono} testID="invoice-bill-number">
                {inv.billNumber || "—"}
              </Text>
              <Text tone="muted">{formatDate(inv.date)}</Text>
            </Col>
            <Col gap={6} align="flex-end">
              <StatusPill status={inv.status} />
              <Money value={inv.grossTotal} variant="h2" />
            </Col>
          </Row>
          <Divider style={{ marginVertical: 12 }} />
          <KeyValue
            items={[
              [
                "Billed to",
                pid ? (
                  <Text tone="accent" onPress={() => nav.navigate("PartyDetail", { id: pid })} testID="invoice-party-link">
                    {snap.name || invoicePartyName(inv)}
                  </Text>
                ) : (
                  <Text>{snap.name || invoicePartyName(inv)}</Text>
                ),
              ],
              [
                "GSTIN",
                <Text key="gstin" style={mono}>
                  {snap.gstin || "—"}
                </Text>,
              ],
              ["Address", snap.address || "—"],
              ["Bookings", String(lines.length)],
              ["Created", formatDateTime(inv.createdAt)],
              ["Updated", formatDateTime(inv.updatedAt)],
            ]}
          />
          {inv.notes ? (
            <Col gap={2} style={{ marginTop: 4 }}>
              <Text variant="caption" tone="faint">
                Notes
              </Text>
              <Text>{inv.notes}</Text>
            </Col>
          ) : null}
        </Card>

        <Col gap={0}>
          <SectionHeader
            title={`Bookings on this bill (${lines.length})`}
            action={
              isDraft && !readOnly ? (
                <Button title="Add bookings" icon={Plus} size="sm" variant="secondary" onPress={() => setAdding(true)} testID="invoice-add-consignments" />
              ) : undefined
            }
          />
          <DataList
            testID="invoice-lines"
            rows={lines}
            columns={columns}
            keyOf={(c) => c.id}
            phoneRight={(c) => (
              <Row gap={4}>
                <Money value={c.totalAmount} variant="bodyStrong" />
                {canEditLines ? removeButton(c) : null}
              </Row>
            )}
          />
        </Col>

        <TotalsBlock totals={totals} amountInWords={inv.amountInWords} testID="invoice-totals" />
      </Col>

      {isDraft ? (
        <>
          <InvoiceEditDialog
            invoice={inv}
            visible={editing}
            onClose={() => setEditing(false)}
            defaults={{ cgst: profile.data?.defaultCgstRate, sgst: profile.data?.defaultSgstRate }}
          />
          <AddConsignmentsDialog invoiceId={inv.id} partyId={pid} visible={adding} onClose={() => setAdding(false)} />
        </>
      ) : null}
    </Screen>
  );
}
