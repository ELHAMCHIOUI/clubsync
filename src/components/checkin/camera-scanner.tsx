import { useEffect, useRef, useState } from "react";
import { SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Flux caméra + décodage continu avec jsqr. Ignore le même code pendant 5 s. */
export function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const { default: jsQR } = await import("jsqr");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setError(null);
        const tick = () => {
          if (stopped) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480) || 360;
            canvas.width = w; canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const res = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (res?.data) {
              const now = Date.now();
              if (!last.current || last.current.code !== res.data || now - last.current.at > 5000) {
                last.current = { code: res.data, at: now };
                cb.current(res.data);
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Impossible d'accéder à la caméra : autorisez-la dans le navigateur.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 m-auto size-48 rounded-2xl border-4 border-primary-glow/80" style={{ borderColor: "var(--primary-glow)" }} />
        {error && <p className="absolute inset-x-0 bottom-0 bg-destructive p-3 text-center text-sm text-destructive-foreground">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
          <SwitchCamera />Changer de caméra
        </Button>
        <Button variant="ghost" onClick={onClose}><X />Fermer</Button>
      </div>
    </div>
  );
}
