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
  KeyRound,
  ShieldCheck,
  X,
  ClipboardPaste,
  School,
} from 'lucide-react';
import type {
  AuthResult,
  SchoolSearchResult,
  SecurityChallengeDTO,
  StudentProfile,
} from '@shared/types';
import {
  decodeQRFromImageBlob,
  decodeQRFromVideoFrame,
  parsePronoteQRText,
  type PronoteQRPayload,
} from '@/utils/qr';

interface LoginViewProps {
  onAuthenticated: (profile: StudentProfile) => void;
}

type AuthTab = 'ent' | 'qr';

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<AuthTab>('ent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entStatus, setEntStatus] = useState<string | null>(null);
  const [entOpen, setEntOpen] = useState(false);

  // ENT search state
  const [schoolQuery, setSchoolQuery] = useState('');
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [schools, setSchools] = useState<SchoolSearchResult[]>([]);

  // QR state
  const [qrPayload, setQrPayload] = useState<PronoteQRPayload | null>(null);
  const [qrPin, setQrPin] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Direct credentials modal
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [credUrl, setCredUrl] = useState('');
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');

  // Security 2FA modal
  const [challenge, setChallenge] = useState<SecurityChallengeDTO | null>(null);
  const [challengePin, setChallengePin] = useState('');
  const [challengeDevice, setChallengeDevice] = useState('Noctis');

  useEffect(() => {
    return window.pronoteAPI.auth.onEntStatus((status) => {
      setEntStatus(status);
    });
  }, []);

  const handleAuthResult = useCallback(
    (res: AuthResult) => {
      setLoading(false);
      setEntOpen(false);
      setEntStatus(null);

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

  // Debounced school search
  useEffect(() => {
    const q = schoolQuery.trim();
    if (q.length < 2) {
      setSchools([]);
      setSearchingSchools(false);
      return;
    }

    let cancelled = false;
    setSearchingSchools(true);
    const timer = setTimeout(async () => {
      try {
        const res = await window.pronoteAPI.auth.searchSchools(q);
        if (!cancelled) {
          setSchools(res);
        }
      } catch {
        if (!cancelled) setSchools([]);
      } finally {
        if (!cancelled) setSearchingSchools(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolQuery]);

  // Global Ctrl+V clipboard paste listener for QR screenshots!
  useEffect(() => {
    if (tab !== 'qr') return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            setError(null);
            const decoded = await decodeQRFromImageBlob(blob);
            if (decoded) {
              setQrPayload(decoded);
              setTimeout(() => pinInputRef.current?.focus(), 60);
            } else {
              setError("Aucun QR Code PRONOTE valide détecté dans l'image collée.");
            }
            return;
          }
        }
      }

      const text = e.clipboardData?.getData('text');
      if (text) {
        const parsed = parsePronoteQRText(text);
        if (parsed) {
          e.preventDefault();
          setError(null);
          setQrPayload(parsed);
          setTimeout(() => pinInputRef.current?.focus(), 60);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [tab]);

  // Stop webcam cleanly on unmount or tab switch
  const stopWebcam = useCallback(() => {
    setWebcamActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (tab !== 'qr') stopWebcam();
    return () => stopWebcam();
  }, [tab, stopWebcam]);

  useEffect(() => {
    if (!webcamActive) return;
    let rafId = 0;
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
          if (videoRef.current && scanCanvasRef.current) {
            const found = decodeQRFromVideoFrame(videoRef.current, scanCanvasRef.current);
            if (found) {
              stopWebcam();
              setQrPayload(found);
              setError(null);
              setTimeout(() => pinInputRef.current?.focus(), 60);
              return;
            }
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => {
        setWebcamActive(false);
        setError("Impossible d'accéder à la webcam. Utilisez plutôt Ctrl+V avec une capture d'écran.");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [webcamActive, stopWebcam]);

  const handleImageFile = async (file: File) => {
    setError(null);
    const decoded = await decodeQRFromImageBlob(file);
    if (decoded) {
      setQrPayload(decoded);
      setTimeout(() => pinInputRef.current?.focus(), 60);
    } else {
      setError("Aucun QR Code PRONOTE valide n'a été trouvé dans cette image.");
    }
  };

  const launchEntLogin = async (options: {
    mode: 'lyceeconnecte' | 'lyceeconnecte-educonnect' | 'lyceeconnecte-direct' | 'url';
    url?: string;
    schoolName?: string;
  }) => {
    setError(null);
    setLoading(true);
    setEntOpen(true);
    setEntStatus(
      options.mode === 'url'
        ? `Ouverture du portail de ${options.schoolName || 'votre établissement'}…`
        : options.mode === 'lyceeconnecte-direct'
        ? 'Ouverture de la connexion Lycée Connecté…'
        : 'Ouverture d’ÉduConnect (Lycée Connecté)…'
    );
    const res = await window.pronoteAPI.auth.loginENT(options);
    handleAuthResult(res);
  };

  const cancelEnt = async () => {
    await window.pronoteAPI.auth.cancelENT();
    setEntOpen(false);
    setLoading(false);
    setEntStatus(null);
  };

  const submitQrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrPayload) {
      setError("Importez ou collez d'abord votre QR Code PRONOTE.");
      return;
    }
    if (qrPin.trim().length !== 4) {
      setError('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await window.pronoteAPI.auth.loginQR({
      qr: qrPayload,
      pin: qrPin.trim(),
    });
    handleAuthResult(res);
  };

  const submitDirectCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credUrl.trim() || !credUser.trim() || !credPass) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await window.pronoteAPI.auth.loginCredentials({
      url: credUrl.trim(),
      username: credUser.trim(),
      password: credPass,
    });
    setShowCredsModal(false);
    handleAuthResult(res);
  };

  const launchDemo = async () => {
    setError(null);
    setLoading(true);
    const res = await window.pronoteAPI.auth.loginDemo();
    handleAuthResult(res);
  };

  const submitSecurityChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await window.pronoteAPI.auth.completeSecurityChallenge({
      pin: challengePin.trim() || undefined,
      deviceName: challengeDevice.trim() || 'Noctis',
    });
    handleAuthResult(res);
  };

  return (
    <div className="flex-1 overflow-y-auto obsidian-glow flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[540px] animate-slide-up">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/90 to-accent/30 border border-white/15 shadow-glow mb-4">
            <span className="text-2xl font-extrabold text-white tracking-tight">N</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bienvenue sur Noctis
          </h1>
          <p className="text-[13.5px] text-zinc-400 mt-1.5">
            Votre espace scolaire moderne sur PC — connectez-vous via{' '}
            <span className="text-zinc-200">Lycée Connecté / ENT</span> ou par{' '}
            <span className="text-zinc-200">QR Code</span>.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl bg-[#0D0D12]/95 border border-white/[0.08] shadow-card overflow-hidden backdrop-blur-xl">
          {/* Method Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-[#08080B] border-b border-white/[0.06] gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTab('ent');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                tab === 'ent'
                  ? 'bg-[#16161F] text-white border border-white/[0.09] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Globe className={`w-4 h-4 ${tab === 'ent' ? 'text-accent' : ''}`} />
              <span>ENT / Lycée Connecté</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('qr');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                tab === 'qr'
                  ? 'bg-[#16161F] text-white border border-white/[0.09] shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <QrCode className={`w-4 h-4 ${tab === 'qr' ? 'text-accent' : ''}`} />
              <span>QR Code (+ PIN)</span>
            </button>
          </div>

          <div className="p-6">
            {/* Error Banner */}
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[12.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Active ENT Progress State */}
            {entOpen && (
              <div className="mb-5 p-4 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">
                      Fenêtre ENT ouverte
                    </div>
                    <div className="text-[12px] text-zinc-300 truncate">
                      {entStatus || 'En attente de votre connexion…'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEnt}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-zinc-200 shrink-0 transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* TAB 1: ENT / LYCÉE CONNECTÉ */}
            {tab === 'ent' && (
              <div className="space-y-4">
                {/* 1-Click Lycée Connecté Hero Button (Direct ÉduConnect SSO -> auto-detects Pronote!) */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => launchEntLogin({ mode: 'lyceeconnecte-educonnect' })}
                    className="group w-full p-4 rounded-xl bg-gradient-to-r from-accent/20 via-accent/10 to-transparent hover:from-accent/30 hover:via-accent/15 border border-accent/30 flex items-center justify-between text-left transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/35 flex items-center justify-center text-accent shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-white flex items-center gap-2">
                          Lycée Connecté · ÉduConnect
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/25 text-accent">
                            Automatique
                          </span>
                        </div>
                        <div className="text-[12px] text-zinc-400 mt-0.5">
                          Connexion directe élève ÉduConnect — Noctis récupère votre PRONOTE tout seul.
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => launchEntLogin({ mode: 'lyceeconnecte-direct' })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121219] hover:bg-[#171722] border border-white/[0.07] flex items-center justify-between text-left text-[12.5px] text-zinc-300 hover:text-white transition-all disabled:opacity-50"
                  >
                    <span>Connexion Lycée Connecté (sans ÉduConnect / identifiant ENT)</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                    ou rechercher votre établissement
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                {/* School Search */}
                <div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={schoolQuery}
                      onChange={(e) => setSchoolQuery(e.target.value)}
                      placeholder="Ville, code postal, nom du lycée ou URL PRONOTE…"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] focus:border-accent/60 focus:outline-none text-[13.5px] text-white placeholder:text-zinc-500 transition-colors"
                    />
                    {searchingSchools && (
                      <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {schools.length > 0 && (
                    <div className="mt-2.5 max-h-52 overflow-y-auto rounded-xl bg-[#0A0A0F] border border-white/[0.07] divide-y divide-white/[0.05]">
                      {schools.map((s) => (
                        <button
                          key={s.url}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            launchEntLogin({ mode: 'url', url: s.url, schoolName: s.name })
                          }
                          className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.05] flex items-center justify-between gap-3 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <School className="w-4 h-4 text-zinc-500 group-hover:text-accent shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-zinc-100 truncate">
                                {s.name}
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate">
                                {s.postalCode ? `${s.postalCode} · ` : ''}
                                {s.url.replace(/^https?:\/\//, '')}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchingSchools && schoolQuery.trim().length >= 3 && schools.length === 0 && (
                    <p className="text-[12px] text-zinc-500 mt-2 px-1">
                      Aucun établissement trouvé pour « {schoolQuery} ». Essayez avec votre ville ou code postal, ou utilisez le bouton Lycée Connecté ci-dessus.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: QR CODE */}
            {tab === 'qr' && (
              <form onSubmit={submitQrLogin} className="space-y-4">
                {webcamActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <canvas ref={scanCanvasRef} className="hidden" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-44 h-44 rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                    </div>
                    <button
                      type="button"
                      onClick={stopWebcam}
                      className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-black text-xs text-white flex items-center gap-1 border border-white/15"
                    >
                      <X className="w-3.5 h-3.5" /> Fermer
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) await handleImageFile(file);
                    }}
                    className={`rounded-xl border-2 border-dashed p-5 text-center transition-all ${
                      qrPayload
                        ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                        : dragOver
                        ? 'border-accent bg-accent/10'
                        : 'border-white/[0.1] bg-[#121218] hover:border-white/[0.18]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                        e.target.value = '';
                      }}
                    />

                    {qrPayload ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                        <div className="text-[13.5px] font-semibold text-white">
                          QR Code PRONOTE détecté !
                        </div>
                        <div className="text-[11.5px] text-zinc-400 truncate max-w-sm mx-auto">
                          {qrPayload.url}
                        </div>
                        <button
                          type="button"
                          onClick={() => setQrPayload(null)}
                          className="text-[11.5px] text-zinc-400 hover:text-white underline underline-offset-2"
                        >
                          Changer de QR Code
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-300">
                          <ClipboardPaste className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[13.5px] font-semibold text-white">
                            Collez votre capture avec{' '}
                            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11.5px] font-mono text-zinc-100">
                              Ctrl+V
                            </kbd>
                          </div>
                          <p className="text-[12px] text-zinc-400 mt-1">
                            Faites <span className="text-zinc-300">Win+Shift+S</span> sur le QR Code PRONOTE puis collez ici, ou glissez une image.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Choisir une image
                          </button>
                          <button
                            type="button"
                            onClick={() => setWebcamActive(true)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.08] text-[12px] font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Webcam
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4-digit PIN */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-[12px] font-medium text-zinc-400 mb-1.5">
                      Code PIN à 4 chiffres (défini sur PRONOTE)
                    </label>
                    <input
                      ref={pinInputRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={qrPin}
                      onChange={(e) => setQrPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#13131A] border border-white/[0.08] focus:border-accent/60 focus:outline-none text-center text-lg tracking-[0.5em] font-mono text-white placeholder:text-zinc-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !qrPayload || qrPin.length !== 4}
                    className="h-[46px] px-5 rounded-xl bg-accent hover:opacity-90 disabled:opacity-40 text-black font-semibold text-[13.5px] flex items-center gap-2 transition-all shadow-glow shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Connexion</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Mini Guide */}
                <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05] text-[11.5px] text-zinc-400 leading-relaxed">
                  <span className="text-zinc-200 font-medium">Comment obtenir le QR Code :</span> Sur PRONOTE Web (via Lycée Connecté), cliquez sur l'icône{' '}
                  <span className="text-zinc-200">QR Code</span> en haut à droite → choisissez un code à 4 chiffres → capturez le QR Code affiché.
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer Secondary Actions */}
        <div className="mt-5 flex items-center justify-between px-1 text-[12.5px]">
          <button
            type="button"
            disabled={loading}
            onClick={launchDemo}
            className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Essayer le Mode Démo PRONOTE</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setError(null);
              setShowCredsModal(true);
            }}
            className="text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Identifiants directs</span>
          </button>
        </div>
      </div>

      {/* Direct Credentials Modal */}
      {showCredsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={submitDirectCredentials}
            className="w-full max-w-md rounded-2xl bg-[#0F0F15] border border-white/[0.1] p-6 space-y-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Connexion directe (sans ENT)</h2>
              <button
                type="button"
                onClick={() => setShowCredsModal(false)}
                className="p-1 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">URL PRONOTE</label>
                <input
                  type="url"
                  required
                  value={credUrl}
                  onChange={(e) => setCredUrl(e.target.value)}
                  placeholder="https://0330000x.index-education.net/pronote"
                  className="w-full px-3 py-2 rounded-xl bg-[#16161E] border border-white/[0.08] text-sm text-white focus:border-accent/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Identifiant</label>
                <input
                  type="text"
                  required
                  value={credUser}
                  onChange={(e) => setCredUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#16161E] border border-white/[0.08] text-sm text-white focus:border-accent/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={credPass}
                  onChange={(e) => setCredPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#16161E] border border-white/[0.08] text-sm text-white focus:border-accent/60 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCredsModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Se connecter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2FA Security Challenge Modal */}
      {challenge && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={submitSecurityChallenge}
            className="w-full max-w-md rounded-2xl bg-[#0F0F15] border border-white/[0.1] p-6 space-y-4 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Vérification de sécurité</h2>
                <p className="text-xs text-zinc-400">{challenge.message}</p>
              </div>
            </div>

            {challenge.shouldEnterPIN && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Code PIN de double authentification
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={challengePin}
                  onChange={(e) => setChallengePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#16161E] border border-white/[0.08] text-center text-lg tracking-[0.5em] font-mono text-white focus:border-accent/60 focus:outline-none"
                />
              </div>
            )}

            {challenge.shouldEnterSource && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Nom de cet appareil (mémorisé sur PRONOTE)
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={challengeDevice}
                  onChange={(e) => setChallengeDevice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#16161E] border border-white/[0.08] text-sm text-white focus:border-accent/60 focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChallenge(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Valider
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
