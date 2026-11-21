import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  KeyRound,
  Camera,
  ImagePlus,
  Search,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Download,
  Smartphone,
  X,
  Lock,
  ExternalLink,
} from 'lucide-react';
import type {
  AuthResult,
  SchoolSearchResult,
  SecurityChallengeDTO,
  StudentProfile,
} from '@shared/types';

interface ParsedQR {
  jeton: string;
  login: string;
  url: string;
}

interface WebLoginViewProps {
  onAuthenticated: (profile: StudentProfile) => void;
}

function tryParseQrPayload(raw: string): ParsedQR | null {
  try {
    const obj = JSON.parse(raw.trim());
    if (obj && typeof obj.jeton === 'string' && typeof obj.login === 'string' && typeof obj.url === 'string') {
      return { jeton: obj.jeton, login: obj.login, url: obj.url };
    }
  } catch {
    // not valid JSON
  }
  return null;
}

export const WebLoginView: React.FC<WebLoginViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'qr' | 'credentials'>('qr');

  // QR Code state
  const [qrData, setQrData] = useState<ParsedQR | null>(null);
  const [qrRawText, setQrRawText] = useState('');
  const [showManualJson, setShowManualJson] = useState(false);
  const [pin, setPin] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Credentials + Universal School Search state
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolSearchResult[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Shared auth state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<SecurityChallengeDTO | null>(null);
  const [challengePin, setChallengePin] = useState('');
  const [challengeDevice, setChallengeDevice] = useState('Noctis Web');

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Debounced French school search
  useEffect(() => {
    const q = schoolQuery.trim();
    if (q.length < 2) {
      setSchoolResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingSchools(true);
      try {
        const list = await window.pronoteAPI.auth.searchSchools(q);
        if (!cancelled) setSchoolResults(list);
      } finally {
        if (!cancelled) setSearchingSchools(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolQuery]);

  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = () => {
          if (!videoRef.current || !streamRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
              if (code?.data) {
                const parsed = tryParseQrPayload(code.data);
                if (parsed) {
                  setQrData(parsed);
                  setQrRawText(code.data);
                  stopCamera();
                  return;
                }
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    } catch {
      setCameraError(
        "Impossible d'accéder à la caméra. Autorise la caméra ou importe simplement une capture d'écran du QR Code."
      );
      stopCamera();
    }
  };

  const handleQrImageUpload = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const decoded = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (!decoded?.data) {
          setError(
            "Aucun QR Code PRONOTE détecté sur cette image. Essaie de recadrer autour du QR Code."
          );
          return;
        }
        const parsed = tryParseQrPayload(decoded.data);
        if (!parsed) {
          setError("Ce QR Code n'est pas un QR Code PRONOTE valide.");
          return;
        }
        setQrData(parsed);
        setQrRawText(decoded.data);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleAuthResult = (res: AuthResult) => {
    if (res.ok && res.profile) {
      setChallenge(null);
      onAuthenticated(res.profile);
      return;
    }
    if (res.challenge?.required) {
      setChallenge(res.challenge);
      setError(null);
      return;
    }
    setError(res.error || 'Connexion impossible. Vérifie tes informations.');
  };

  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = qrData || tryParseQrPayload(qrRawText);
    if (!parsed) {
      setError('Scanne ou importe d’abord ton QR Code PRONOTE.');
      return;
    }
    if (!/^\d{4}$/.test(pin.trim())) {
      setError('Entre le code PIN à 4 chiffres choisi lors de la génération du QR Code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await window.pronoteAPI.auth.loginQR({ qr: parsed, pin: pin.trim() });
      handleAuthResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la connexion QR Code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceUrl.trim()) {
      setError("Sélectionne ton établissement ou entre son adresse PRONOTE.");
      return;
    }
    if (!username.trim() || !password) {
      setError('Entre ton identifiant et ton mot de passe PRONOTE.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await window.pronoteAPI.auth.loginCredentials({
        url: instanceUrl.trim(),
        username: username.trim(),
        password,
      });
      handleAuthResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await window.pronoteAPI.auth.completeSecurityChallenge({
        pin: challengePin.trim() || undefined,
        deviceName: challengeDevice.trim() || 'Noctis Web',
      });
      handleAuthResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la validation 2FA.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto obsidian-glow bg-[#060608] flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Brand */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent/90 to-accent/35 border border-white/15 shadow-glow flex items-center justify-center mb-3.5">
            <span className="text-2xl font-black text-white leading-none">N</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connexion à Noctis Web
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md mx-auto">
            Accède à ton vrai espace scolaire PRONOTE directement depuis ton navigateur (PC, Mac,
            iPhone ou Android).
          </p>
        </div>

        {/* Main Login Card */}
        <div className="rounded-3xl bg-[#0D0D14] border border-white/[0.08] p-5 sm:p-6 shadow-2xl space-y-5">
          {challenge ? (
            <form onSubmit={handleChallengeSubmit} className="space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <span>Validation de sécurité PRONOTE</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {challenge.message ||
                  'Ton établissement demande une confirmation avant d’ouvrir cette session.'}
              </p>

              {challenge.shouldEnterPIN && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Code PIN PRONOTE (4 chiffres)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={challengePin}
                    onChange={(e) => setChallengePin(e.target.value)}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-sm text-white tracking-widest focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {challenge.shouldEnterSource && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Nom de cet appareil
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={challengeDevice}
                    onChange={(e) => setChallengeDevice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.06] text-xs font-semibold text-zinc-300 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-black text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Valider et ouvrir Noctis
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#08080D] border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setMode('qr');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mode === 'qr'
                      ? 'bg-accent text-black shadow-glow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR Code (ENT)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setMode('credentials');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mode === 'credentials'
                      ? 'bg-accent text-black shadow-glow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Identifiants directs</span>
                </button>
              </div>

              {mode === 'qr' ? (
                <form onSubmit={handleQrSubmit} className="space-y-4">
                  {/* How to get QR Code */}
                  <div className="p-3.5 rounded-2xl bg-accent/[0.07] border border-accent/20 text-[11.5px] text-zinc-300 space-y-1.5 leading-relaxed">
                    <div className="font-semibold text-white">
                      Compatible avec tous les ENT de France (Lycée Connecté, ÉduConnect, Atrium…)
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-zinc-400">
                      <li>Ouvre PRONOTE depuis ton ENT habituel.</li>
                      <li>
                        Clique sur l'icône <strong className="text-zinc-200">QR Code</strong> en
                        haut de PRONOTE et choisis un code à 4 chiffres.
                      </li>
                      <li>
                        Scanne-le avec ta caméra ou importe simplement une capture d'écran ci-dessous.
                      </li>
                    </ol>
                  </div>

                  {/* QR Capture Buttons */}
                  {!qrData ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="cursor-pointer py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors">
                          <ImagePlus className="w-4 h-4 text-accent" />
                          <span>Importer une capture</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleQrImageUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={cameraOpen ? stopCamera : startCamera}
                          className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                        >
                          <Camera className="w-4 h-4 text-accent" />
                          <span>{cameraOpen ? 'Fermer la caméra' : 'Scanner avec la caméra'}</span>
                        </button>
                      </div>

                      {cameraError && (
                        <div className="p-2.5 rounded-xl bg-amber-500/12 border border-amber-500/25 text-[11.5px] text-amber-200">
                          {cameraError}
                        </div>
                      )}

                      {cameraOpen && (
                        <div className="relative rounded-2xl overflow-hidden bg-black border border-accent/40 aspect-square max-h-64 mx-auto">
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-44 h-44 rounded-2xl border-2 border-accent shadow-glow" />
                          </div>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setShowManualJson((v) => !v)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
                        >
                          {showManualJson
                            ? 'Masquer le collage manuel'
                            : 'Ou coller le JSON du QR Code manuellement'}
                        </button>
                      </div>

                      {showManualJson && (
                        <textarea
                          rows={3}
                          value={qrRawText}
                          onChange={(e) => {
                            setQrRawText(e.target.value);
                            const parsed = tryParseQrPayload(e.target.value);
                            if (parsed) setQrData(parsed);
                          }}
                          placeholder='{"jeton":"...","login":"...","url":"https://..."}'
                          className="w-full p-3 rounded-xl bg-[#08080D] border border-white/[0.1] text-xs font-mono text-zinc-200 focus:outline-none focus:border-accent"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-emerald-200">
                            QR Code PRONOTE détecté
                          </div>
                          <div className="text-[11px] text-emerald-300/80 truncate">
                            {qrData.url.replace(/^https?:\/\//, '')}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQrData(null);
                          setQrRawText('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[11px] text-zinc-300 hover:text-white shrink-0"
                      >
                        Changer
                      </button>
                    </div>
                  )}

                  {/* 4-digit PIN */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Code PIN à 4 chiffres (choisi sur PRONOTE)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Ex : 1234"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-sm text-white tracking-[0.3em] font-semibold focus:outline-none focus:border-accent"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !qrData || pin.length !== 4}
                    className="w-full py-3 rounded-xl bg-accent text-black text-sm font-bold flex items-center justify-center gap-2 shadow-glow hover:opacity-90 disabled:opacity-45 transition-opacity"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connexion en cours…
                      </>
                    ) : (
                      'Se connecter à mon PRONOTE'
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCredsSubmit} className="space-y-4">
                  {/* Universal School Search */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-300">
                      Rechercher ton établissement (ville, code postal ou nom)
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        value={schoolQuery}
                        onChange={(e) => {
                          setSchoolQuery(e.target.value);
                          setSelectedSchoolName(null);
                        }}
                        placeholder="Ex : Lyon, 69001, Lycée Victor Hugo…"
                        className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-accent"
                      />
                      {searchingSchools ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                      ) : schoolQuery.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSchoolQuery('');
                            setSelectedSchoolName(null);
                            setSchoolResults([]);
                          }}
                          className="text-zinc-500 hover:text-zinc-200 absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {schoolResults.length > 0 && !selectedSchoolName && (
                      <div className="max-h-48 overflow-y-auto rounded-xl bg-[#08080D] border border-white/[0.08] divide-y divide-white/[0.05]">
                        {schoolResults.map((s) => (
                          <button
                            key={s.url}
                            type="button"
                            onClick={() => {
                              setInstanceUrl(s.url);
                              setSelectedSchoolName(s.name);
                              setSchoolQuery(s.name);
                              setSchoolResults([]);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-white/[0.05] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {s.name}
                              </div>
                              <div className="text-[10.5px] text-zinc-500 truncate">
                                {s.postalCode} · {s.url.replace(/^https?:\/\//, '')}
                              </div>
                            </div>
                            <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    {schoolQuery.trim().length >= 2 &&
                      !searchingSchools &&
                      !selectedSchoolName &&
                      schoolResults.length === 0 && (
                        <div className="px-3 py-2 rounded-xl bg-[#08080D] border border-white/[0.06] text-[11px] text-zinc-500">
                          Aucun établissement PRONOTE trouvé pour « {schoolQuery.trim()} ». Essaie
                          avec le nom du lycée/collège ou le code postal.
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Adresse PRONOTE de l'établissement
                    </label>
                    <input
                      type="url"
                      value={instanceUrl}
                      onChange={(e) => setInstanceUrl(e.target.value)}
                      placeholder="https://0690000x.index-education.net/pronote"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Identifiant élève
                      </label>
                      <input
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Identifiant"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Mot de passe
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Si ton établissement passe par un ENT (ÉduConnect / Lycée Connecté…), utilise
                    l'onglet <strong className="text-zinc-300">QR Code (ENT)</strong>.
                  </p>

                  {error && (
                    <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-accent text-black text-sm font-bold flex items-center justify-center gap-2 shadow-glow hover:opacity-90 disabled:opacity-45 transition-opacity"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connexion en cours…
                      </>
                    ) : (
                      'Se connecter'
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Download App & iPhone Notice */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="./download.html"
            className="p-3.5 rounded-2xl bg-[#0D0D14] hover:bg-[#13131E] border border-white/[0.08] flex items-center gap-3 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Télécharger Noctis</div>
              <div className="text-[11px] text-zinc-400">
                Apps Windows (.exe) & Android (.apk) avec connexion ENT & mode hors ligne
              </div>
            </div>
          </a>

          <div className="p-3.5 rounded-2xl bg-[#0D0D14] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-zinc-300 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Sur iPhone ?</div>
              <div className="text-[11px] text-zinc-400">
                Pas d'app iOS dédiée — sur Safari, fais{' '}
                <strong className="text-zinc-200">Partager → Sur l'écran d'accueil</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Legal Footer */}
        <footer className="mt-6 pt-4 border-t border-white/[0.06] text-center space-y-1.5 text-[11px] text-zinc-500">
          <div className="inline-flex items-center justify-center gap-1.5 text-zinc-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>
              Session éphémère en mémoire uniquement · Aucun mot de passe stocké sur nos serveurs
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Client open-source non affilié à Index-Éducation (PRONOTE®)</span>
            <span>·</span>
            <a href="./legal.html" className="text-zinc-300 hover:text-white underline underline-offset-2">
              Mentions légales & Confidentialité
            </a>
            <span>·</span>
            <a
              href="https://github.com/Tipiltheglitcher/Noctis"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-300 hover:text-white inline-flex items-center gap-1"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};
