import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, X } from "lucide-react";
import { countryFlag } from "@/lib/countryFlag";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const data = await res.json();
          const city: string = data.city || data.locality || data.principalSubdivision || "";
          const country: string = data.countryName || "";
          const code: string = data.countryCode || "";
          const label = [city, country].filter(Boolean).join(", ") || "My location";
          onChange({ label, country: code || null, lat: latitude, lng: longitude });
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
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex gap-2">
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
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleUseLocation} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <MapPin className="w-4 h-4 mr-1.5" />}
        Use my location
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Type instead
      </Button>
    </div>
  );
}