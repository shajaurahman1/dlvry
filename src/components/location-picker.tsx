import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Loader2, Locate, Search } from "lucide-react";
import { getPositionOnce, readGeoPermission, type PermissionState } from "@/lib/geo";
import { toast } from "sonner";

// Default Leaflet marker icons (Vite doesn't resolve the CSS-referenced images)
const DEFAULT_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DEFAULT_ICON;

export interface PickedLocation {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
}

interface Props {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  /** Show a small debug panel with permission / coords / errors while testing. */
  debug?: boolean;
  title?: string;
  hint?: string;
  /** Hide the "use my GPS" button (e.g. picking a customer's address). */
  allowGps?: boolean;
}

interface DebugInfo {
  supported: boolean;
  permission: PermissionState;
  lastError?: { code: number; message: string };
}

interface Suggestion {
  lat: number;
  lng: number;
  label: string;
}

async function searchPlaces(q: string): Promise<Suggestion[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`,
  );
  const d = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return (d ?? []).map((x) => ({
    lat: parseFloat(x.lat),
    lng: parseFloat(x.lon),
    label: x.display_name,
  }));
}

export function LocationPicker({
  value,
  onChange,
  debug = false,
  title = "Shop location",
  hint = "Choose your shop location. Delivery partners within the service radius will see your orders.",
  allowGps = true,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [info, setInfo] = useState<DebugInfo>({
    supported: typeof navigator !== "undefined" && !!navigator.geolocation,
    permission: "unknown",
  });

  useEffect(() => {
    void readGeoPermission().then((permission) => setInfo((i) => ({ ...i, permission })));
  }, [busy, value]);

  const captureGPS = async () => {
    setBusy(true);
    try {
      const fix = await getPositionOnce();
      onChange({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
      setInfo((i) => ({ ...i, permission: "granted", lastError: undefined }));
      toast.success("Location captured");
    } catch (err) {
      const e = err as Error & { code?: number };
      setInfo((i) => ({ ...i, lastError: { code: e.code ?? 0, message: e.message } }));
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {value
            ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}${value.accuracy ? ` · ±${Math.round(value.accuracy)} m` : ""}`
            : hint}
        </p>
        {value?.address && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{value.address}</p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {allowGps && (
            <Button
              type="button"
              variant="outline"
              onClick={captureGPS}
              disabled={busy}
              className="rounded-full"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Locate className="mr-1.5 h-4 w-4" />
              )}
              {value ? "Recapture GPS" : "Use current GPS"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setMapOpen(true)}
            className="rounded-full"
          >
            <Search className="mr-1.5 h-4 w-4" /> Search / pick on map
          </Button>
        </div>
      </div>

      {debug && (
        <details className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Location debug</summary>
          <ul className="mt-2 space-y-1">
            <li>
              Geolocation supported: <b>{String(info.supported)}</b>
            </li>
            <li>
              Permission: <b>{info.permission}</b>
            </li>
            <li>
              Latitude: <b>{value?.lat ?? "—"}</b>
            </li>
            <li>
              Longitude: <b>{value?.lng ?? "—"}</b>
            </li>
            <li>
              Accuracy: <b>{value?.accuracy ? `${Math.round(value.accuracy)} m` : "—"}</b>
            </li>
            <li>
              Last error code: <b>{info.lastError?.code ?? "—"}</b>
            </li>
            <li>
              Last error message: <b>{info.lastError?.message ?? "—"}</b>
            </li>
          </ul>
        </details>
      )}

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className="p-5 pb-2">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <MapPickerBody
            initial={value ?? undefined}
            onConfirm={(loc) => {
              onChange(loc);
              setMapOpen(false);
              toast.success("Location saved");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MapPickerBody({
  initial,
  onConfirm,
}: {
  initial?: PickedLocation;
  onConfirm: (loc: PickedLocation) => void;
}) {
  const [pin, setPin] = useState<PickedLocation>(initial ?? { lat: 20.5937, lng: 78.9629 });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [address, setAddress] = useState<string | undefined>(initial?.address);

  // Debounced type-ahead search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(q));
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const d = await r.json();
      if (d?.display_name) setAddress(d.display_name);
    } catch {
      /* ignore */
    }
  };

  const pick = (s: Suggestion) => {
    setPin({ lat: s.lat, lng: s.lng });
    setAddress(s.label);
    setResults([]);
    setQuery(s.label);
  };

  const useMyGps = async () => {
    try {
      const fix = await getPositionOnce();
      setPin({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
      void reverseGeocode(fix.lat, fix.lng);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3 p-5 pt-0">
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your location — address, shop name, area…"
          />
          <Button
            type="button"
            variant="outline"
            onClick={useMyGps}
            className="rounded-full"
            aria-label="Use my GPS"
          >
            <Locate className="h-4 w-4" />
          </Button>
        </div>
        {(searching || results.length > 0) && (
          <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card shadow-elevated">
            {searching && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
            {results.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(s)}
                className="block w-full truncate border-b border-border/60 px-3 py-2 text-left text-xs last:border-0 hover:bg-muted"
              >
                <MapPin className="mr-1.5 inline h-3 w-3 text-primary" />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-[360px] w-full overflow-hidden rounded-xl border border-border">
        <MapContainer
          center={[pin.lat, pin.lng]}
          zoom={initial ? 16 : 5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker
            pin={pin}
            setPin={(p) => {
              setPin(p);
              void reverseGeocode(p.lat, p.lng);
            }}
          />
          <Recenter lat={pin.lat} lng={pin.lng} />
          <ClickToPlace
            onPlace={(p) => {
              setPin(p);
              void reverseGeocode(p.lat, p.lng);
            }}
          />
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Tap or drag the pin.{" "}
        {address ? <span className="block truncate">{address}</span> : "Choose the exact spot."}
        <span className="block">
          Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </span>
      </p>

      <Button
        type="button"
        onClick={() => onConfirm({ ...pin, address })}
        className="h-11 w-full rounded-full font-semibold"
      >
        Confirm this location
      </Button>
    </div>
  );
}

function DraggableMarker({
  pin,
  setPin,
}: {
  pin: PickedLocation;
  setPin: (p: PickedLocation) => void;
}) {
  const ref = useRef<L.Marker>(null);
  return (
    <Marker
      draggable
      position={[pin.lat, pin.lng]}
      ref={ref}
      eventHandlers={{
        dragend: () => {
          const m = ref.current;
          if (!m) return;
          const p = m.getLatLng();
          setPin({ lat: p.lat, lng: p.lng });
        },
      }}
    />
  );
}

function ClickToPlace({ onPlace }: { onPlace: (p: PickedLocation) => void }) {
  useMapEvents({ click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}
