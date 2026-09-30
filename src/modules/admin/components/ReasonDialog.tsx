/** Dialog that collects a reason (≥3 chars) before a reject / suspend. */
import React, { useEffect, useState } from "react";
import { Button, Dialog, Text, TextField } from "@shared/ui";

export function ReasonDialog({
  visible,
  title,
  message,
  confirmLabel,
  loading,
  onClose,
  onSubmit,
  testID,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  testID: string;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      setReason("");
      setTouched(false);
    }
  }, [visible]);
  const trimmed = reason.trim();
  const error =
    touched && trimmed.length < 3
      ? "Give a reason (at least 3 characters)"
      : undefined;
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={title}
      testID={testID}
      width={460}
      footer={
        <>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            testID={`${testID}-cancel`}
          />
          <Button
            title={confirmLabel}
            variant="danger"
            loading={loading}
            testID={`${testID}-submit`}
            onPress={() => {
              setTouched(true);
              if (trimmed.length >= 3 && trimmed.length <= 300)
                onSubmit(trimmed);
            }}
          />
        </>
      }
    >
      {message ? <Text tone="muted">{message}</Text> : null}
      <TextField
        testID={`${testID}-reason`}
        label="Reason"
        value={reason}
        onChangeText={setReason}
        onBlur={() => setTouched(true)}
        multiline
        maxLength={300}
        error={error}
        hint="Recorded in the audit log and shown to the agency."
      />
    </Dialog>
  );
}
