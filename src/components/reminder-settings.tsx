import { useReminders } from "@/lib/reminders";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const EVENT_LEAD_OPTIONS: { mins: number; label: string }[] = [
  { mins: 10080, label: "1 week" },
  { mins: 2880,  label: "2 days" },
  { mins: 1440,  label: "1 day" },
  { mins: 180,   label: "3 hours" },
  { mins: 60,    label: "1 hour" },
  { mins: 15,    label: "15 min" },
];

const SESSION_LEAD_OPTIONS = [60, 30, 15, 10, 5];

export function ReminderSettingsButton() {
  const { permission, settings, setSettings, enable, disable, scheduledCount, testNotify } = useReminders();
  const granted = permission === "granted";
  const active = granted && settings.enabled;

  const handleToggle = async () => {
    if (active) {
      disable();
      toast.success("Reminders off");
      return;
    }
    if (permission === "unsupported") {
      toast.error("This browser does not support notifications.");
      return;
    }
    if (permission === "denied") {
      toast.error("Notifications are blocked. Enable them in your browser site settings.");
      return;
    }
    const ok = await enable();
    if (ok) {
      toast.success("Reminders enabled");
      testNotify();
    } else {
      toast.error("Permission denied");
    }
  };

  const toggleEventLead = (mins: number) => {
    const set = new Set(settings.eventLeadsMin);
    if (set.has(mins)) set.delete(mins); else set.add(mins);
    setSettings({ eventLeadsMin: Array.from(set).sort((a, b) => b - a) });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {active ? <BellRing className="w-3.5 h-3.5 mr-1.5 text-primary" /> :
           permission === "denied" ? <BellOff className="w-3.5 h-3.5 mr-1.5" /> :
           <Bell className="w-3.5 h-3.5 mr-1.5" />}
          <span className="text-xs font-mono uppercase tracking-[0.1em]">
            {active ? `Reminders · ${scheduledCount}` : "Reminders"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">Device reminders</div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Browser notifications for calendar entries and live race-weekend sessions.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={handleToggle} />
          </div>

          {permission === "denied" && (
            <div className="text-[11px] rounded-sm border border-destructive/40 bg-destructive/10 text-destructive px-2 py-1.5">
              Notifications blocked. Allow them in browser site settings, then reload.
            </div>
          )}
          {permission === "unsupported" && (
            <div className="text-[11px] rounded-sm border border-border bg-muted/30 text-muted-foreground px-2 py-1.5">
              This browser doesn't support notifications.
            </div>
          )}

          <div>
            <Label className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
              Calendar event leads
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EVENT_LEAD_OPTIONS.map((o) => {
                const on = settings.eventLeadsMin.includes(o.mins);
                return (
                  <button
                    key={o.mins}
                    onClick={() => toggleEventLead(o.mins)}
                    className={`text-[11px] font-mono px-2 py-1 rounded-sm border transition-colors ${
                      on ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
              Session start alarm
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SESSION_LEAD_OPTIONS.map((m) => {
                const on = settings.sessionLeadMin === m;
                return (
                  <button
                    key={m}
                    onClick={() => setSettings({ sessionLeadMin: m })}
                    className={`text-[11px] font-mono px-2 py-1 rounded-sm border transition-colors ${
                      on ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m} min before
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground leading-snug border-t border-border pt-2">
            On supported browsers (Chrome / Edge / Android) reminders also fire when the tab is closed. On iOS, install to Home Screen and keep the app installed.
          </div>

          {active && (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={testNotify}>
              Send test notification
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}