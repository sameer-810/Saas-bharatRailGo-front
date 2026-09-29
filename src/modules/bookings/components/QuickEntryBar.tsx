/**
 * Quick-entry bar — the counter clerk types one line
 * ("DLI 3pkg 60kg Sharma topay 1550") and gets a labelled live preview.
 * Enter / Continue hands a BookingPrefill to `onSubmit`.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ArrowRight, Zap } from "lucide-react-native";
import { Button, Card, Col, Row, Text, TextField } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { loadPartyOptions, loadStationOptions } from "@shared/api/lookups";
import { useDebounced } from "@shared/hooks/useDebounced";
import { formatMoney } from "@shared/lib/format";
import type { Option } from "@shared/ui/controls";
import {
  bestPartyMatch,
  hasUsefulQuickEntry,
  parseQuickEntry,
  type QuickTokenKind,
} from "../lib/parseQuickEntry";
import { PAYMENT_MODE_LABEL, type BookingPrefill } from "../lib/types";

const KIND_LABEL: Record<QuickTokenKind, string> = {
  destination: "To",
  origin: "From",
  packages: "Pkgs",
  weight: "Wt",
  party: "Party",
  paymentMode: "Mode",
  amount: "Freight",
  unmatched: "?",
};

async function resolveParty(q: string): Promise<Option<string> | null> {
  const opts = await loadPartyOptions(q);
  return bestPartyMatch(q, opts) ?? null;
}

export function QuickEntryBar({
  onSubmit,
  submitLabel = "Continue",
  testID = "quick-entry",
  compact,
}: {
  onSubmit: (prefill: BookingPrefill) => void;
  submitLabel?: string;
  testID?: string;
  compact?: boolean;
}) {
  const t = useTheme();
  const { isPhone } = useLayout();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parsed = useMemo(() => parseQuickEntry(text), [text]);
  const partyQ = useDebounced(parsed.partyQuery || "", 250);
  const stationQ = useDebounced(parsed.destinationStation || "", 250);

  const [party, setParty] = useState<{ q: string; match: Option<string> | null; loading: boolean }>({
    q: "",
    match: null,
    loading: false,
  });
  const [station, setStation] = useState<{ q: string; name: string | null }>({ q: "", name: null });
  const partyCache = useRef(new Map<string, Option<string> | null>());

  useEffect(() => {
    if (!partyQ) {
      setParty({ q: "", match: null, loading: false });
      return;
    }
    const key = partyQ.toLowerCase();
    if (partyCache.current.has(key)) {
      setParty({ q: partyQ, match: partyCache.current.get(key) ?? null, loading: false });
      return;
    }
    let alive = true;
    setParty((p) => ({ ...p, q: partyQ, loading: true }));
    resolveParty(partyQ)
      .then((m) => {
        partyCache.current.set(key, m);
        if (alive) setParty({ q: partyQ, match: m, loading: false });
      })
      .catch(() => alive && setParty({ q: partyQ, match: null, loading: false }));
    return () => {
      alive = false;
    };
  }, [partyQ]);

  useEffect(() => {
    if (!stationQ) {
      setStation({ q: "", name: null });
      return;
    }
    let alive = true;
    loadStationOptions(stationQ)
      .then((opts) => {
        const hit = opts.find((o) => o.value.toUpperCase() === stationQ.toUpperCase());
        if (alive) setStation({ q: stationQ, name: hit ? hit.label.replace(/^[^—]*—\s*/, "") : null });
      })
      .catch(() => alive && setStation({ q: stationQ, name: null }));
    return () => {
      alive = false;
    };
  }, [stationQ]);

  const useful = hasUsefulQuickEntry(parsed);

  const submit = async () => {
    if (!useful || submitting) return;
    setSubmitting(true);
    try {
      let match: Option<string> | null = null;
      const q = parsed.partyQuery;
      if (q) {
        const key = q.toLowerCase();
        match = partyCache.current.has(key)
          ? (partyCache.current.get(key) ?? null)
          : await resolveParty(q).catch(() => null);
      }
      const prefill: BookingPrefill = {
        destinationStation: parsed.destinationStation,
        originStation: parsed.originStation,
        packages: parsed.packages,
        chargeableWeight: parsed.chargeableWeight,
        paymentMode: parsed.paymentMode,
        freightAmount: parsed.amount,
        partyId: match?.value,
        partyName: match?.label,
      };
      // drop undefined keys so they are not written into the URL
      const clean = Object.fromEntries(
        Object.entries(prefill).filter(([, v]) => v !== undefined && v !== ""),
      ) as BookingPrefill;
      onSubmit(clean);
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const valueFor = (kind: QuickTokenKind, raw: string): { value: string; faded?: boolean; warn?: boolean } => {
    switch (kind) {
      case "destination":
        return {
          value: parsed.originStation
            ? `${parsed.originStation} → ${parsed.destinationStation}`
            : `${parsed.destinationStation}${station.q === parsed.destinationStation && station.name ? ` · ${station.name}` : ""}`,
        };
      case "packages":
        return { value: `${parsed.packages}` };
      case "weight":
        return { value: `${parsed.chargeableWeight} kg` };
      case "paymentMode":
        return { value: parsed.paymentMode ? PAYMENT_MODE_LABEL[parsed.paymentMode] : raw };
      case "amount":
        return { value: formatMoney(parsed.amount) };
      case "party": {
        const settled = party.q.toLowerCase() === (parsed.partyQuery || "").toLowerCase() && !party.loading;
        if (!settled) return { value: `${raw}…` };
        return party.match ? { value: party.match.label } : { value: `${raw} (no match)`, warn: true };
      }
      default:
        return { value: raw, faded: true };
    }
  };

  return (
    <Card padding={compact ? 12 : 16} testID={`${testID}-card`}>
      <Col gap={10}>
        <Row gap={8}>
          <Zap size={16} color={t.c.accent} />
          <Text variant="overline" tone="muted">
            Quick entry
          </Text>
          {!isPhone ? (
            <Text variant="caption" tone="faint" style={{ flex: 1 }} numberOfLines={1}>
              Type one line, press Enter — e.g. DLI 3pkg 60kg Sharma topay 1550
            </Text>
          ) : null}
        </Row>
        <Row gap={8} align="flex-start" style={{ flexDirection: isPhone ? "column" : "row" }}>
          <View style={{ flex: isPhone ? undefined : 1, alignSelf: "stretch" }}>
            <TextField
              testID={`${testID}-input`}
              value={text}
              onChangeText={setText}
              placeholder="DLI 3pkg 60kg Sharma topay 1550"
              autoCapitalize="none"
              autoCorrect={false}
              mono
              returnKeyType="go"
              blurOnSubmit={false}
              onSubmitEditing={submit}
            />
          </View>
          <Button
            testID={`${testID}-continue`}
            title={submitLabel}
            icon={ArrowRight}
            onPress={submit}
            disabled={!useful}
            loading={submitting}
            fullWidth={isPhone}
          />
        </Row>
        {parsed.tokens.length ? (
          <Row wrap gap={6} testID={`${testID}-preview`}>
            {parsed.tokens.map((tok, i) => {
              const v = valueFor(tok.kind, tok.raw);
              const loading = tok.kind === "party" && party.loading;
              return (
                <View
                  key={`${i}-${tok.kind}-${tok.raw}`}
                  testID={`${testID}-chip-${tok.kind}`}
                  accessibilityLabel={`${KIND_LABEL[tok.kind]}: ${v.value}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 10,
                    minHeight: 30,
                    borderRadius: t.radius.pill,
                    borderWidth: 1,
                    borderStyle: v.faded ? "dashed" : "solid",
                    borderColor: v.warn ? t.c.warning : v.faded ? t.c.border : t.c.accent,
                    backgroundColor: v.faded ? "transparent" : v.warn ? t.c.warningSoft : t.c.accentSoft,
                    opacity: v.faded ? 0.6 : 1,
                  }}
                >
                  <Text variant="overline" tone={v.faded ? "faint" : v.warn ? "warning" : "accent"}>
                    {KIND_LABEL[tok.kind]}
                  </Text>
                  <Text
                    variant="label"
                    tone={v.faded ? "faint" : "default"}
                    style={
                      tok.kind === "destination" || tok.kind === "amount" || tok.kind === "weight" || tok.kind === "packages"
                        ? { fontFamily: t.fonts.mono }
                        : undefined
                    }
                  >
                    {v.value}
                  </Text>
                  {loading ? <ActivityIndicator size="small" color={t.c.accent} /> : null}
                </View>
              );
            })}
          </Row>
        ) : null}
      </Col>
    </Card>
  );
}
