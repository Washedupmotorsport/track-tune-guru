import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Flag, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  WavingFlags,
  DEFAULT_FLAG_SETTINGS,
  loadFlagSettings,
  saveFlagSettings,
  type FlagSettings,
} from "@/components/waving-flags";

export const Route = createFileRoute("/_authenticated/flags")({
  component: FlagsSettingsPage,
});

const SIZE_PRESETS = [
  { label: "Small", className: "w-12 h-12" },
  { label: "Medium", className: "w-16 h-16" },
  { label: "Large", className: "w-24 h-24" },
  { label: "Huge", className: "w-40 h-40" },
];

function FlagsSettingsPage() {
  const [settings, setSettings] = useState<FlagSettings>(() => loadFlagSettings());
  const [previewSize, setPreviewSize] = useState("w-40 h-40");

  const update = <K extends keyof FlagSettings>(key: K, value: FlagSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveFlagSettings(next);
  };

  const reset = () => {
    setSettings(DEFAULT_FLAG_SETTINGS);
    saveFlagSettings(DEFAULT_FLAG_SETTINGS);
  };

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Flag className="w-3 h-3" /> Loading flags
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Waving flag controls</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tweak the loading spinner. Changes save instantly and apply across the app.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="w-4 h-4 mr-2" /> Reset defaults
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mt-8">
        {/* Preview */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">Live preview</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="min-h-[280px] flex items-center justify-center bg-background/50 rounded border border-border">
            <WavingFlags className={previewSize} {...settings} />
          </div>
          <div className="mt-4">
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Preview size</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPreviewSize(p.className)}
                  className={`py-2 text-xs font-mono uppercase tracking-widest rounded border transition-colors ${
                    previewSize === p.className
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">Animation</h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Speed <span className="text-primary">(seconds per wave)</span>
              </Label>
              <span className="font-mono text-sm">{settings.speed.toFixed(2)}s</span>
            </div>
            <Slider
              className="mt-2"
              value={[settings.speed]}
              min={0.3}
              max={3}
              step={0.1}
              onValueChange={(v) => update("speed", v[0])}
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>Fast</span><span>Slow</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Wave amount <span className="text-primary">(degrees)</span>
              </Label>
              <span className="font-mono text-sm">{settings.waveAmount.toFixed(0)}°</span>
            </div>
            <Slider
              className="mt-2"
              value={[settings.waveAmount]}
              min={2}
              max={20}
              step={1}
              onValueChange={(v) => update("waveAmount", v[0])}
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>Subtle</span><span>Dramatic</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">Colors</h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <ColorField
            label="Dark squares"
            value={settings.darkColor}
            onChange={(v) => update("darkColor", v)}
          />
          <ColorField
            label="Light squares"
            value={settings.lightColor}
            onChange={(v) => update("lightColor", v)}
          />
          <ColorField
            label="Flag pole"
            value={settings.poleColor}
            onChange={(v) => update("poleColor", v)}
          />

          <div className="pt-2">
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 block">
              Color presets
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <PresetButton
                label="Classic checkered"
                dark="#1a1a1a" light="#f5f5f5" pole="#b0b0b0"
                onClick={(p) => {
                  const next = { ...settings, ...p };
                  setSettings(next);
                  saveFlagSettings(next);
                }}
              />
              <PresetButton
                label="Racing red"
                dark="#8b0000" light="#fff5f5" pole="#c0c0c0"
                onClick={(p) => { const next = { ...settings, ...p }; setSettings(next); saveFlagSettings(next); }}
              />
              <PresetButton
                label="Track blue"
                dark="#0a2540" light="#e8f0fa" pole="#9aa0a6"
                onClick={(p) => { const next = { ...settings, ...p }; setSettings(next); saveFlagSettings(next); }}
              />
              <PresetButton
                label="Gold & black"
                dark="#0a0a0a" light="#d4a73c" pole="#8a6b1e"
                onClick={(p) => { const next = { ...settings, ...p }; setSettings(next); saveFlagSettings(next); }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="flex gap-2 mt-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 rounded border border-input cursor-pointer bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function PresetButton({
  label, dark, light, pole, onClick,
}: {
  label: string; dark: string; light: string; pole: string;
  onClick: (p: { darkColor: string; lightColor: string; poleColor: string }) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick({ darkColor: dark, lightColor: light, poleColor: pole })}
      className="flex items-center gap-2 p-2 rounded border border-border hover:border-primary hover:bg-accent transition-colors text-left"
    >
      <div className="flex gap-1">
        <span className="w-4 h-4 rounded-sm border border-border" style={{ background: dark }} />
        <span className="w-4 h-4 rounded-sm border border-border" style={{ background: light }} />
        <span className="w-4 h-4 rounded-sm border border-border" style={{ background: pole }} />
      </div>
      <span className="text-xs font-mono">{label}</span>
    </button>
  );
}
