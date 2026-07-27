import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Continuously watch device location and upsert into driver_locations.
 * Enable only when the driver is on-shift (has active orders).
 */
export function useDriverLocationTracker({
  driverId,
  tenantId,
  enabled,
}: {
  driverId: string | undefined;
  tenantId: string | null | undefined;
  enabled: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "watching" | "denied" | "unsupported" | "error">("idle");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled || !driverId || !tenantId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("watching");
    let lastPushed = 0;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPushed < 10000) return; // throttle 10s
        lastPushed = now;
        try {
          await (supabase.from("driver_locations") as any).upsert({
            driver_id: driverId,
            tenant_id: tenantId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            updated_at: new Date().toISOString(),
          });
          await (supabase.from("driver_location_points") as any).insert({
            driver_id: driverId,
            tenant_id: tenantId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLastUpdate(new Date());
        } catch {
          setStatus("error");
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, [enabled, driverId, tenantId]);

  return { status, lastUpdate };
}

/** Subscribe to a specific driver's live location (for customer tracking). */
export function useDriverLocation(driverId: string | null | undefined) {
  const [loc, setLoc] = useState<{ lat: number; lng: number; updated_at: string } | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from("driver_locations") as any)
        .select("lat, lng, updated_at")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (!cancelled && data) setLoc(data);
    })();

    const ch = supabase
      .channel(`loc-${driverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as { lat: number; lng: number; updated_at: string };
          if (row?.lat != null) setLoc(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [driverId]);

  return loc;
}
