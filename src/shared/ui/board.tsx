/**
 * Departure-board primitives — the signature look of the product.
 *
 *   <FlapText text="DLI" width={4} />    split-flap cells that flip into place
 *   <Board title="Today's departures">…</Board>   dark station-board frame
 *   <BoardRow cells={[...]} />            one row of a board
 *
 * Flips respect reduced motion (only the final text is shown).
 */
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../useTheme";
import { Row, Text } from "./primitives";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduced).catch(() => undefined);
  }, []);
  return reduced;
}

/** One split-flap cell. */
function Flap({ char, delay, size }: { char: string; delay: number; size: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? char : " ");

  useEffect(() => {
    if (reduced) {
      setShown(char);
      return;
    }
    let ticks = 0;
    const total = 5 + Math.floor(delay / 40);
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        ticks += 1;
        if (ticks >= total) {
          setShown(char);
          if (timer) clearInterval(timer);
        } else {
          setShown(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
        }
      }, 45);
    }, delay);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [char, delay, reduced]);

  return (
    <View
      style={{
        width: size * 0.78,
        height: size * 1.25,
        borderRadius: 3,
        backgroundColor: t.c.boardCell,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          fontFamily: t.fonts.monoBold,
          fontSize: size,
          lineHeight: size * 1.2,
          color: t.c.boardText,
        }}
      >
        {shown}
      </Text>
      {/* the hinge line across the middle of a real flap */}
      <View style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
    </View>
  );
}

/** Text rendered as split-flap cells, padded/truncated to `width` cells. */
export function FlapText({
  text,
  width,
  size = 18,
  stagger = 35,
  testID,
}: {
  text: string;
  width?: number;
  size?: number;
  stagger?: number;
  testID?: string;
}) {
  const raw = String(text ?? "").toUpperCase();
  const chars = (width ? raw.padEnd(width, " ").slice(0, width) : raw).split("");
  return (
    <Row gap={2} testID={testID} accessible accessibilityLabel={raw.trim()}>
      {chars.map((c, i) => (
        <Flap key={`${i}-${c}`} char={c} delay={i * stagger} size={size} />
      ))}
    </Row>
  );
}

/** Dark station-board frame. */
export function Board({
  title,
  right,
  children,
  style,
  testID,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[{ backgroundColor: t.c.board, borderRadius: t.radius.lg, padding: 16, gap: 10 }, style]}
    >
      {title || right ? (
        <Row justify="space-between" style={{ marginBottom: 4 }}>
          {title ? (
            <Text style={{ fontFamily: t.fonts.monoBold, fontSize: 13, letterSpacing: 2, color: t.c.boardText }}>
              {title.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {right}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

/** Plain (non-flipping) board text — for dense rows where flipping every cell is too much. */
export function BoardText({ children, dim, size = 14 }: { children: React.ReactNode; dim?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <Text style={{ fontFamily: t.fonts.mono, fontSize: size, color: dim ? t.c.boardDim : t.c.boardText, fontVariant: ["tabular-nums"] }}>
      {children}
    </Text>
  );
}
