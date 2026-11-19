import React, { useEffect, useRef, useState } from 'react';
import {
  QrCode,
  KeyRound,
  Sparkles,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Download,
  ClipboardPaste,
  Server,
  X,
} from 'lucide-react';
import type { AuthResult, StudentProfile } from '@shared/types';
import {
  decodeQRFromImageBlob,
  decodeQRFromVideoFrame,
  parsePronoteQRText,
  type PronoteQRPayload,
} from '../../../PC/src/utils/qr';
import { getRelayUrl, setRelayUrl } from '@/config';

interface WebLoginViewProps {
  onAuthenticated: (profile: StudentProfile) => void;
}

export const WebLoginView: React.FC<WebLoginViewProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'qr' | 'creds'>('qr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR
  const [qrPayload, setQrPayload] = useState<PronoteQRPayload | null>(null);
  const [qrPin, setQrPin] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Direct credentials
  const [credUrl, setCredUrl] = useState('');
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');

  // Optional Cloudflare Relay config
  const [relayOpen, setRelayOpen] = useState(false);
  const [relayInput, setRelayInput] = useState(() => getRelayUrl());
  const [relaySaved, setRelaySaved] = useState(false);

  const handleResult = (res: AuthResult) => {
    setLoading(false);
    if (res.ok && res.profile) {
      setError(null);
      onAuthenticated(res.profile);
      return;
    }
    setError(res.error || 'Échec de la connexion.');
  };

  useEffect(() => {
    if (tab !== 'qr') return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const decoded = await decodeQRFromImageBlob(blob);
            if (decoded) {
              setQrPayload(decoded);
              setError(null);
            } else {
              setError("Aucun QR Code PRONOTE valide dans l'image collée.");
            }
            return;
          }
        }
      }
      const txt = e.clipboardData?.getData('text');
      if (txt) {
        const p = parsePronoteQRText(txt);
        if (p) {
          setQrPayload(p);
          setError(null);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tab]);

  useEffect(() => {
    if (!webcamActive) return;
    let raf = 0;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        const tick = () => {
          if (cancelled) return;
          if (videoRef.current && canvasRef.current) {
            const found = decodeQRFromVideoFrame(videoRef.current, canvasRef.current);
            if (found) {
              setWebcamActive(false);
              stream.getTracks().forEach((t) => t.stop());
              setQrPayload(found);
              setError(null);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        setWebcamActive(false);
        setError('Accès caméra impossible.');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [webcamActive]);

  const submitQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrPayload || qrPin.length !== 4) return;
    setLoading(true);
    setError(null);
    handleResult(await window.pronoteAPI.auth.loginQR({ qr: qrPayload, pin: qrPin }));
  };

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    handleResult(
      await window.pronoteAPI.auth.loginCredentials({
        url: credUrl,
        username: credUser,
        password: credPass,
      })
    );
  };

  const launchDemo = async () => {
    setLoading(true);
    setError(null);
    handleResult(await window.pronoteAPI.auth.loginDemo());
  };

  return (
    <div className="flex-1 overflow-y-auto obsidian-glow flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[540px] space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 border border-white/15 shadow-glow mb-3">
            <span className="text-2xl font-extrabold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Noctis Web</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Connecte-toi directement depuis ton navigateur — session temporaire (rien n'est enregistré si tu fermes l'onglet).
          </p>
        </div>

        {/* Download App Promo Card */}
        <a
          href="./download.html"
          className="p-3.5 rounded-2xl bg-gradient-to-r from-accent/20 via-accent/10 to-transparent hover:from-accent/30 border border-accent/35 flex items-center justify-between gap-3 transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/35 flex items-center justify-center text-accent shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                Tu préfères l'app Windows (.exe) ou Android (.apk) ?
              </div>
              <div className="text-[11px] text-zinc-300">
                Connexion Lycée Connecté automatique + session mémorisée + mises à jour auto
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-accent shrink-0" />
        </a>

        {/* Login Card */}
        <div className="rounded-2xl bg-[#0D0D13] border border-white/[0.08] overflow-hidden shadow-card">
          <div className="grid grid-cols-2 p-1.5 bg-[#08080B] border-b border-white/[0.06] gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTab('qr');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${
                tab === 'qr'
                  ? 'bg-[#161620] text-white border border-white/[0.09]'
                  : 'text-zinc-400'
              }`}
            >
              <QrCode className={`w-4 h-4 ${tab === 'qr' ? 'text-accent' : ''}`} />
              QR Code (+ PIN)
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('creds');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${
                tab === 'creds'
                  ? 'bg-[#161620] text-white border border-white/[0.09]'
                  : 'text-zinc-400'
              }`}
            >
              <KeyRound className={`w-4 h-4 ${tab === 'creds' ? 'text-accent' : ''}`} />
              Identifiants directs
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {tab === 'qr' ? (
              <form onSubmit={submitQr} className="space-y-4">
                {webcamActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-white/10">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                      type="button"
                      onClick={() => setWebcamActive(false)}
                      className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 text-xs text-white flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Fermer
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-white/[0.1] bg-[#121219] p-5 text-center space-y-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const d = await decodeQRFromImageBlob(f);
                        if (d) {
                          setQrPayload(d);
                          setError(null);
                        } else {
                          setError('QR Code PRONOTE non détecté dans cette image.');
                        }
                        e.target.value = '';
                      }}
                    />
                    {qrPayload ? (
                      <div className="space-y-1.5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-xs font-semibold text-white">QR Code détecté !</div>
                        <button
                          type="button"
                          onClick={() => setQrPayload(null)}
                          className="text-[11px] text-zinc-400 underline"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <>
                        <ClipboardPaste className="w-6 h-6 text-zinc-400 mx-auto" />
                        <div className="text-xs text-zinc-300">
                          Colle ta capture QR Code avec <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Ctrl+V</kbd>
                        </div>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs text-zinc-200 flex items-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" /> Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setWebcamActive(true)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs text-zinc-200 flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" /> Caméra
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={qrPin}
                    onChange={(e) => setQrPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="PIN ••••"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] text-center font-mono tracking-[0.4em] text-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || !qrPayload || qrPin.length !== 4}
                    className="px-5 rounded-xl bg-accent text-black text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connexion'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitCreds} className="space-y-3">
                <input
                  type="url"
                  required
                  value={credUrl}
                  onChange={(e) => setCredUrl(e.target.value)}
                  placeholder="https://033xxxx.index-education.net/pronote"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={credUser}
                  onChange={(e) => setCredUser(e.target.value)}
                  placeholder="Identifiant PRONOTE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] text-xs text-white"
                />
                <input
                  type="password"
                  required
                  value={credPass}
                  onChange={(e) => setCredPass(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-accent text-black text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Se connecter
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Actions: Demo + Relay Setup */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <button
            type="button"
            onClick={launchDemo}
            className="text-zinc-300 hover:text-white flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Essayer la Démo Web</span>
          </button>

          <button
            type="button"
            onClick={() => setRelayOpen((v) => !v)}
            className="text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"
          >
            <Server className="w-3.5 h-3.5" />
            <span>{relayInput ? 'Relais Web configuré ✓' : 'Configurer relais Cloudflare'}</span>
          </button>
        </div>

        {relayOpen && (
          <div className="p-4 rounded-2xl bg-[#0D0D13] border border-white/[0.08] space-y-2.5 text-xs">
            <div className="font-semibold text-white">Relais CORS PRONOTE (Cloudflare Worker gratuit)</div>
            <p className="text-zinc-400 leading-relaxed">
              Les navigateurs bloquent les appels directs vers PRONOTE (CORS). Déploie le fichier{' '}
              <code className="text-accent">Site-Web/cloudflare-worker/worker.js</code> sur{' '}
              <a
                href="https://dash.cloudflare.com"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                Cloudflare Workers
              </a>{' '}
              (gratuit) et colle son URL ci-dessous :
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={relayInput}
                onChange={(e) => {
                  setRelayInput(e.target.value);
                  setRelaySaved(false);
                }}
                placeholder="https://noctis-relay.ton-compte.workers.dev"
                className="flex-1 px-3 py-2 rounded-xl bg-[#14141C] border border-white/[0.08] text-white"
              />
              <button
                type="button"
                onClick={() => {
                  setRelayUrl(relayInput);
                  setRelaySaved(true);
                }}
                className="px-3.5 rounded-xl bg-accent text-black font-bold"
              >
                {relaySaved ? 'OK ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
