"use client";

import * as React from "react";
import { realtimeWsUrl } from "@/lib/api";
import type { DataQuality, RealtimeFrame } from "@/types/api";

export type WsStatus =
  | "IDLE"
  | "CONNECTING"
  | "OPEN"
  | "CLOSING"
  | "CLOSED"
  | "ERROR";

export interface LatestPointValue {
  pointId: number;
  value: number | null;
  timestamp: string;
  quality: DataQuality;
}

export interface UseRealtimeOptions {
  /** When false, the hook is inert (no connection). */
  enabled: boolean;
  /** Point ids to subscribe to. */
  pointIds: number[];
  /** Called for every received frame. */
  onFrame?: (frame: RealtimeFrame) => void;
  /** Reconnect strategy. */
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

/**
 * Subscribe to the CarbonOps realtime WebSocket. Manages connect / reconnect /
 * cleanup. Re-emits each frame via `onFrame` and keeps a `values` map keyed by
 * pointId.
 */
export function useRealtime({
  enabled,
  pointIds,
  onFrame,
  reconnectDelayMs = 3000,
  maxReconnectAttempts = 3,
}: UseRealtimeOptions) {
  const [status, setStatus] = React.useState<WsStatus>("IDLE");
  const [values, setValues] = React.useState<Record<number, LatestPointValue>>(
    {}
  );
  const [error, setError] = React.useState<string | null>(null);

  // Keep latest callbacks without re-running the connect effect.
  const onFrameRef = React.useRef(onFrame);
  React.useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Reset values when the subscription set changes.
  const pointIdsKey = pointIds.join(",");
  React.useEffect(() => {
    setValues({});
  }, [pointIdsKey]);

  React.useEffect(() => {
    if (!enabled || pointIds.length === 0) {
      setStatus("IDLE");
      return;
    }

    let ws: WebSocket | null = null;
    let attempt = 0;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      setStatus("CONNECTING");
      const url = realtimeWsUrl(pointIds);
      try {
        ws = new WebSocket(url);
      } catch (err) {
        setStatus("ERROR");
        setError(err instanceof Error ? err.message : "WebSocket 创建失败");
        return;
      }

      ws.onopen = () => {
        if (stopped) return;
        attempt = 0;
        setStatus("OPEN");
        setError(null);
      };

      ws.onmessage = (event) => {
        if (stopped) return;
        let data: RealtimeFrame | { code?: number; msg?: string; type?: string };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        // Auth rejection / info frames do not carry point payloads.
        if (
          data &&
          typeof data === "object" &&
          "type" in data &&
          data.type === "point"
        ) {
          const frame = data as RealtimeFrame;
          setValues((prev) => ({
            ...prev,
            [frame.pointId]: {
              pointId: frame.pointId,
              value: frame.value,
              timestamp: frame.timestamp,
              quality: frame.quality,
            },
          }));
          onFrameRef.current?.(frame);
        }
      };

      ws.onerror = () => {
        if (stopped) return;
        setStatus("ERROR");
        setError("WebSocket 连接发生错误");
      };

      ws.onclose = (event) => {
        if (stopped) return;
        setStatus(event.wasClean ? "CLOSED" : "ERROR");
        if (!event.wasClean && attempt < maxReconnectAttempts) {
          attempt += 1;
          setStatus("CONNECTING");
          reconnectTimer = setTimeout(connect, reconnectDelayMs);
        } else {
          setStatus("CLOSED");
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, "client unmount");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pointIdsKey, reconnectDelayMs, maxReconnectAttempts]);

  return { status, values, error };
}
