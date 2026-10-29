import { useEffect, useState } from "react";
import { Globe, Radar } from "lucide-react";
import {
  BOM_RADAR_URL,
  GENERAL_RADAR_URL,
  getPosition,
  radarMapUrl,
} from "@/lib/weather";

/**
 * Radar link that recentres on the device position once it is known.
 * Falls back to the general radar map when location is unavailable.
 */
export function useRadarHref(): string {
  const [href, setHref] = useState(GENERAL_RADAR_URL);

  useEffect(() => {
    let alive = true;
    getPosition()
      .then((p) => {
        if (alive) setHref(radarMapUrl(p.coords.latitude, p.coords.longitude));
      })
      .catch(() => {
        /* keep the general radar map */
      });
    return () => {
      alive = false;
    };
  }, []);

  return href;
}

export function WeatherRadarLinks({
  iconOnly = false,
  className = "",
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  const nearMeHref = useRadarHref();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <RadarLink
        href={nearMeHref}
        label="Radar near me"
        title="Live rain radar centred on your location"
        icon={Radar}
        iconOnly={iconOnly}
      />
      <RadarLink
        href={BOM_RADAR_URL}
        label="BOM radar"
        title="Bureau of Meteorology rain radar (Australia)"
        icon={Globe}
        iconOnly={iconOnly}
      />
    </div>
  );
}

function RadarLink({
  href, label, title, icon: Icon, iconOnly,
}: {
  href: string; label: string; title: string; icon: typeof Radar; iconOnly: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 font-mono uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${
        iconOnly ? "h-6 w-6 justify-center p-0" : "px-2 py-1 text-[10px]"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {!iconOnly && <span>{label}</span>}
    </a>
  );
}
