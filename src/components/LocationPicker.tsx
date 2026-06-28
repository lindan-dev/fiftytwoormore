import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X, Map as MapIcon } from "lucide-react";
import { countryFlag } from "@/lib/countryFlag";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet+bundlers issue)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export interface LocationValue {
  label: string;
  country?: string | null; // ISO-2 code
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  value: LocationValue | null;
  onChange: (val: LocationValue | null) => void;
}

export default function LocationPicker({ value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const { toast } = useToast();

  const reverseGeocode = async (
    latitude: number,
    longitude: number,
  ): Promise<LocationValue> => {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      const data = await res.json();
      const city: string = data.city || data.locality || data.principalSubdivision || "";
      const country: string = data.countryName || "";
      const code: string = data.countryCode || "";
      const label = [city, country].filter(Boolean).join(", ") || "Pinned location";
      return { label, country: code || null, lat: latitude, lng: longitude };
    } catch {
      return {
        label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        lat: latitude,
        lng: longitude,
      };
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not supported", description: "Geolocation isn't available in this browser.", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const v = await reverseGeocode(latitude, longitude);
          onChange(v);
        } catch (e) {
          toast({ title: "Couldn't fetch place", description: "Saved coordinates only.", variant: "destructive" });
          onChange({
            label: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        toast({
          title: "Location blocked",
          description: err.message || "Allow location access or type a place below.",
          variant: "destructive",
        });
        setEditing(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const mapPickerDialog = (
    <MapPickerDialog
      open={mapOpen}
      onOpenChange={setMapOpen}
      initial={value && value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null}
      onPick={async (lat, lng) => {
        setLoading(true);
        const v = await reverseGeocode(lat, lng);
        onChange(v);
        setLoading(false);
        setMapOpen(false);
      }}
    />
  );

  if (value && !editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm">
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {countryFlag(value.country)} {value.label}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
            aria-label="Clear location"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setMapOpen(true)}>
          Pick on map
        </button>
        {mapPickerDialog}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex gap-2 flex-wrap">
        <Input
          autoFocus
          placeholder="e.g. Stockholm, Sweden"
          value={value?.label || ""}
          onChange={(e) => onChange({ ...(value || {}), label: e.target.value })}
          maxLength={80}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={handleUseLocation} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <MapPin className="w-4 h-4 mr-1.5" />}
        Use my location
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setMapOpen(true)}>
        <MapIcon className="w-4 h-4 mr-1.5" />
        Pick on map
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Type instead
      </Button>
      {mapPickerDialog}
    </div>
  );
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  if (pos) map.setView([pos.lat, pos.lng], map.getZoom());
  return null;
}

function MapPickerDialog({
  open,
  onOpenChange,
  initial,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(initial);
  const center: [number, number] = initial ? [initial.lat, initial.lng] : [20, 0];
  const zoom = initial ? 10 : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick a location</DialogTitle>
        </DialogHeader>
        <div className="h-[60vh] w-full rounded-md overflow-hidden border">
          <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={(lat, lng) => setPos({ lat, lng })} />
            {pos && <Marker position={[pos.lat, pos.lng]} />}
            <RecenterOnChange pos={pos} />
          </MapContainer>
        </div>
        <p className="text-xs text-muted-foreground">Tap or click anywhere on the map to drop a pin.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!pos} onClick={() => pos && onPick(pos.lat, pos.lng)}>
            Use this spot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}