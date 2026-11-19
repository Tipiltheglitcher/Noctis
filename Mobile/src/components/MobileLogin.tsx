import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Globe,
  QrCode,
  Search,
  Sparkles,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  X,
  School,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  EntLogin,
  type AuthResult,
  type SchoolSearchResult,
  type SecurityChallengeDTO,
  type StudentProfile,
} from '@/types';
import { mobilePronote } from '@/services/pronote';
import { decodeQRFromBlob, decodeQRFromVideo, type PronoteQRPayload } from '@/utils/qr';

interface MobileLoginProps {
  onAuthenticated: (profile: StudentProfile) => void;
}

export const MobileLogin: React.FC<MobileLoginProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'ent' | 'qr'>('ent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // School search
  const [schoolQuery, setSchoolQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [schools, setSchools] = useState<SchoolSearchResult[]>([]);

  // QR
  const [qrPayload, setQrPayload] = useState<PronoteQRPayload | null>(null);
  const [qrPin, setQrPin] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 2FA
  const [challenge, setChallenge] = useState<SecurityChallengeDTO | null>(null);
  const [challengePin, setChallengePin] = useState('');

  const handleResult = useCallback(
    (res: AuthResult) => {
      setLoading(false);
      if (res.ok && res.profile) {
        setError(null);
        setChallenge(null);
        onAuthenticated(res.profile);
        return;
      }
      if (res.challenge?.required) {
        setChallenge(res.challenge);
        setError(null);
        return;
      }
      setError(res.error || 'Échec de la connexion.');
    },
    [onAuthenticated]
  );

  useEffect(() => {
    const q = schoolQuery.trim();
    if (q.length < 2) {
      setSchools([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const list = await mobilePronote.searchSchools(q);
        if (!cancelled) setSchools(list);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [schoolQuery]);

  const stopCamera = useCallback(() => {
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (tab !== 'qr') stopCamera();
    return () => stopCamera();
  }, [tab, stopCamera]);

  useEffect(() => {
    if (!cameraActive) return;
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
            const decoded = decodeQRFromVideo(videoRef.current, canvasRef.current);
            if (decoded) {
              stopCamera();
              setQrPayload(decoded);
              setError(null);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        setCameraActive(false);
        setError("Accès caméra refusé. Importez une capture d'écran du QR Code depuis la galerie.");
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cameraActive, stopCamera]);

  const launchEnt = async (options: {
    mode: 'lyceeconnecte-educonnect' | 'lyceeconnecte-direct' | 'url';
    url?: string;
    schoolName?: string;
  }) => {
    if (!Capacitor.isNativePlatform()) {
      setError("La connexion ENT intégrée nécessite l'application Android (.apk).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const nativeRes = await EntLogin.startLogin(options);
      const authRes = await mobilePronote.loginWithToken({
        url: nativeRes.url,
        username: nativeRes.username,
        token: nativeRes.token,
        deviceUUID: nativeRes.deviceUUID,
      });
      handleResult(authRes);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Connexion ENT annulée ou échouée.');
    }
  };

  const submitQr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrPayload || qrPin.length !== 4) return;
    setError(null);
    setLoading(true);
    const res = await mobilePronote.loginWithQR({ qr: qrPayload, pin: qrPin });
    handleResult(res);
  };

  const launchDemo = async () => {
    setError(null);
    setLoading(true);
    const res = await mobilePronote.loginDemo();
    handleResult(res);
  };

  const submitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await mobilePronote.completeSecurityChallenge({
      pin: challengePin.trim() || undefined,
      deviceName: 'Noctis Android',
    });
    handleResult(res);
  };

  return (
    <div className="h-full overflow-y-auto obsidian-glow safe-top safe-bottom px-5 py-8 flex flex-col justify-between">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Brand */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 border border-white/15 shadow-glow mb-3">
            <span className="text-2xl font-extrabold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Noctis</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Ton espace scolaire moderne en noir sur Android
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl bg-[#0D0D13] border border-white/[0.08] overflow-hidden">
          <div className="grid grid-cols-2 p-1.5 bg-[#08080B] border-b border-white/[0.06] gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTab('ent');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 ${
                tab === 'ent'
                  ? 'bg-[#171722] text-white border border-white/[0.09]'
                  : 'text-zinc-400'
              }`}
            >
              <Globe className={`w-4 h-4 ${tab === 'ent' ? 'text-accent' : ''}`} />
              ENT / Lycée
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('qr');
                setError(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 ${
                tab === 'qr'
                  ? 'bg-[#171722] text-white border border-white/[0.09]'
                  : 'text-zinc-400'
              }`}
            >
              <QrCode className={`w-4 h-4 ${tab === 'qr' ? 'text-accent' : ''}`} />
              QR Code
            </button>
          </div>

          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {tab === 'ent' && (
              <div className="space-y-3.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => launchEnt({ mode: 'lyceeconnecte-educonnect' })}
                  className="w-full p-3.5 rounded-xl bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/35 flex items-center justify-between text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/35 flex items-center justify-center text-accent shrink-0">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-white">
                        Lycée Connecté · ÉduConnect
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Détection automatique de PRONOTE
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => launchEnt({ mode: 'lyceeconnecte-direct' })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#13131B] border border-white/[0.07] text-xs text-zinc-300 flex items-center justify-between"
                >
                  <span>Lycée Connecté (sans ÉduConnect)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>

                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[10.5px] uppercase tracking-wider text-zinc-500">
                    ou rechercher un lycée
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    placeholder="Ville, code postal ou lycée…"
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#14141D] border border-white/[0.08] text-sm text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
                  />
                  {searching && (
                    <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {schools.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl bg-[#0A0A0F] border border-white/[0.06] divide-y divide-white/[0.05]">
                    {schools.map((s) => (
                      <button
                        key={s.url}
                        type="button"
                        disabled={loading}
                        onClick={() => launchEnt({ mode: 'url', url: s.url, schoolName: s.name })}
                        className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 active:bg-white/[0.06]"
                      >
                        <School className="w-4 h-4 text-accent shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-white truncate">{s.name}</div>
                          <div className="text-[10.5px] text-zinc-500 truncate">{s.postalCode}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'qr' && (
              <form onSubmit={submitQr} className="space-y-3.5">
                {cameraActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square border border-white/10">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/75 text-xs text-white flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Fermer
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-white/[0.12] bg-[#12121A] text-center space-y-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const decoded = await decodeQRFromBlob(f);
                        if (decoded) {
                          setQrPayload(decoded);
                          setError(null);
                        } else {
                          setError('Aucun QR Code PRONOTE valide dans cette image.');
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
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setCameraActive(true)}
                          className="w-full py-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <Camera className="w-4 h-4" /> Scanner avec la caméra
                        </button>
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="w-full py-2.5 rounded-xl bg-white/[0.06] text-zinc-200 text-xs font-medium flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" /> Importer une capture d'écran
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={qrPin}
                    onChange={(e) => setQrPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="PIN ••••"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[#14141D] border border-white/[0.08] text-center text-base font-mono tracking-[0.4em] text-white"
                  />
                  <button
                    type="submit"
                    disabled={loading || !qrPayload || qrPin.length !== 4}
                    className="px-5 rounded-xl bg-accent text-black text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Demo button */}
        <button
          type="button"
          disabled={loading}
          onClick={launchDemo}
          className="w-full py-2.5 text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Essayer le Mode Démo PRONOTE
        </button>
      </div>

      {/* 2FA Modal */}
      {challenge && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5">
          <form
            onSubmit={submitChallenge}
            className="w-full max-w-sm rounded-2xl bg-[#101018] border border-white/10 p-5 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-accent" />
              <div className="text-sm font-bold text-white">Vérification sécurité</div>
            </div>
            <p className="text-xs text-zinc-400">{challenge.message}</p>
            {challenge.shouldEnterPIN && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={challengePin}
                onChange={(e) => setChallengePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Code PIN ••••"
                className="w-full py-2.5 rounded-xl bg-[#171722] border border-white/10 text-center font-mono tracking-[0.4em] text-white"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChallenge(null)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.06] text-xs text-zinc-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-bold"
              >
                Valider
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
