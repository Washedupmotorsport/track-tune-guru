import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

// Minimal cross-browser SpeechRecognition typing
type SRConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function VoiceRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<InstanceType<SRConstructor> | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
  }, []);

  const start = () => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true; r.interimResults = false; r.lang = navigator.language || "en-US";
    let finalText = "";
    r.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) finalText += e.results[i][0].transcript + " ";
    };
    r.onerror = (e) => { toast.error(`Mic: ${e.error}`); setRecording(false); };
    r.onend = () => {
      setRecording(false);
      const t = finalText.trim();
      if (t) onTranscript(t);
    };
    r.start(); recRef.current = r; setRecording(true);
  };
  const stop = () => recRef.current?.stop();

  if (!supported) return null;
  return (
    <Button type="button" size="sm" variant={recording ? "destructive" : "outline"} onClick={recording ? stop : start}>
      {recording ? <><Square className="w-4 h-4 mr-1" /> Stop</> : <><Mic className="w-4 h-4 mr-1" /> Voice note</>}
    </Button>
  );
}