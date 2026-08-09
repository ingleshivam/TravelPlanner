"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AlertCircle, MapPin } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

type Status = "loading" | "not-configured" | "not-found" | "ready";

export default function TripMap({ query }: { query: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [label, setLabel] = useState(query);

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setStatus("not-configured");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    async function run() {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
            `?access_token=${MAPBOX_TOKEN}&limit=1`,
        );
        const data = await res.json();
        const feature = data.features?.[0];
        if (cancelled) return;

        if (!feature) {
          setStatus("not-found");
          return;
        }

        const [lng, lat] = feature.center as [number, number];
        setLabel(feature.place_name || query);

        mapRef.current?.remove();
        if (!containerRef.current) return;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [lng, lat],
          zoom: 14,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
        mapRef.current = map;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("not-found");
      }
    }

    run();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [query]);

  if (status === "not-configured") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <AlertCircle size={16} className="shrink-0 text-primary" />
        Map isn&apos;t set up yet — add NEXT_PUBLIC_MAPBOX_TOKEN to see this on a map.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-sm font-medium text-foreground">
        <MapPin size={14} className="text-primary" />
        {label}
      </div>
      <div className="relative h-64 w-full">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Finding {query}...
          </div>
        )}
        {status === "not-found" && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Couldn&apos;t find &ldquo;{query}&rdquo; on the map.
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
