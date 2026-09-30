/** Edit a payment (amount / date / mode / reference / notes). Saving re-runs the FIFO split. */
import React, { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Col,
  DateField,
  Dialog,
  NumberField,
  SegmentedControl,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import {
  PAYMENT_MODE_OPTIONS,
  type Payment,
  type PaymentInput,
  type PaymentMode,
} from "../types";

export const PAYMENT_INVALIDATE = [
  "payments",
  "consignments",
  "parties",
  "dashboard",
  "reports",
];

export function PaymentEditDialog({
  payment,
  visible,
  onClose,
}: {
  payment: Payment;
  visible: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number | undefined>(payment.amount);
  const [date, setDate] = useState(String(payment.date).slice(0, 10));
  const [mode, setMode] = useState<PaymentMode>(payment.mode);
  const [ref, setRef] = useState(payment.referenceNumber || "");
  const [notes, setNotes] = useState(payment.notes || "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmount(payment.amount);
    setDate(String(payment.date).slice(0, 10));
    setMode(payment.mode);
    setRef(payment.referenceNumber || "");
    setNotes(payment.notes || "");
    setErr(null);
  }, [visible, payment]);

  const update = useApiMutation<Payment, PaymentInput>(
    "patch",
    `/payments/${payment.id}`,
    {
      invalidate: PAYMENT_INVALIDATE,
    },
  );

  const save = async () => {
    if (!amount || amount <= 0) return setErr("Enter an amount above zero.");
    if (!date) return setErr("Pick a date.");
    setErr(null);
    try {
      await update.mutateAsync({
        amount,
        date,
        mode,
        referenceNumber: mode === "cash" ? "" : ref.trim(),
        notes: notes.trim(),
      });
      toast.success("Payment updated and re-allocated");
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setErr(apiErrorMessage(e));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Edit payment"
      testID="payment-edit-dialog"
      footer={
        <>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            testID="payment-edit-cancel"
          />
          <Button
            title="Save"
            onPress={save}
            loading={update.isPending}
            testID="payment-edit-save"
          />
        </>
      }
    >
      <Banner
        tone="info"
        title="Saving re-allocates this payment"
        message="The old split is reversed, then the new amount is applied again to the party's oldest open bookings."
      />
      {err ? (
        <Text tone="danger" testID="payment-edit-error">
          {err}
        </Text>
      ) : null}
      <NumberField
        label="Amount (₹)"
        value={amount}
        onChange={setAmount}
        testID="payment-edit-amount"
      />
      <DateField
        label="Date"
        value={date}
        onChange={setDate}
        testID="payment-edit-date"
      />
      <Col gap={6}>
        <Text variant="label" tone="muted">
          Mode
        </Text>
        <SegmentedControl
          value={mode}
          options={PAYMENT_MODE_OPTIONS}
          onChange={setMode}
          testID="payment-edit-mode"
        />
      </Col>
      {mode !== "cash" ? (
        <TextField
          label="Reference no."
          value={ref}
          onChangeText={setRef}
          mono
          placeholder="UPI txn ID / cheque no."
          testID="payment-edit-reference"
        />
      ) : null}
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        testID="payment-edit-notes"
      />
    </Dialog>
  );
}
