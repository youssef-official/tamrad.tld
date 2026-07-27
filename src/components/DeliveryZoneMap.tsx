import { Circle, MapContainer, Polygon, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number };
export type ZoneShape = "circle" | "polygon";

function ClickCapture({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export function DeliveryZoneMap({
  shape,
  center,
  radiusKm,
  points,
  onPick,
}: {
  shape: ZoneShape;
  center: MapPoint;
  radiusKm: number;
  points: MapPoint[];
  onPick: (point: MapPoint) => void;
}) {
  return (
    <div className="h-72 overflow-hidden rounded-xl border border-border" dir="ltr">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={onPick} />
        {shape === "circle" ? (
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#1f5f3f", fillOpacity: 0.18 }}
          />
        ) : points.length >= 3 ? (
          <Polygon
            positions={points.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#1f5f3f", fillOpacity: 0.18 }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
