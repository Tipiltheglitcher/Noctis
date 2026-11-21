import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ArrowLeft,
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
  getWebRememberMe,
  inspectWebPronoteInstance,
  setWebRememberMe,
  type WebSchoolInstanceInfo,
} from '../webPronoteBridge';

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
    if (
      obj &&
      typeof obj.jeton === 'string' &&
      typeof obj.login === 'string' &&
      typeof obj.url === 'string'
    ) {
      return { jeton: obj.jeton, login: obj.login, url: obj.url };
    }
  } catch {
    // not valid JSON
  }
  return null;
}

export const WebLoginView: React.FC<WebLoginViewProps> = ({ onAuthenticated }) => {
  // Flow step: 'pick' (search school) | 'ent-qr' (ENT school detected -> open ENT + QR) | 'direct' (non-ENT school -> ID/pass) | 'quick-qr' (already have QR)
  const [step, setStep] = useState<'pick' | 'ent-qr' | 'direct' | 'quick-qr'>('pick');

  // School search & inspection state
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<SchoolSearchResult[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [inspectingSchool, setInspectingSchool] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<WebSchoolInstanceInfo | null>(null);

  // QR Code state
  const [qrData, setQrData] = useState<ParsedQR | null>(null);
  const [qrRawText, setQrRawText] = useState('');
  const [showManualJson, setShowManualJson] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pin, setPin] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  // Direct credentials state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getWebRememberMe());

  // Shared auth / 2FA state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<SecurityChallengeDTO | null>(null);
  const [challengePin, setChallengePin] = useState('');
  const [challengeDevice, setChallengeDevice] = useState('Noctis Web');

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const decodeQrFromFile = useCallback((file: File) => {
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
        setTimeout(() => pinInputRef.current?.focus(), 60);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }, []);

  // Global Ctrl+V paste support for screenshots (Win+Shift+S -> Ctrl+V directly!)
  useEffect(() => {
    if (step !== 'ent-qr' && step !== 'quick-qr') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            decodeQrFromFile(file);
            return;
          }
        }
      }
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        const parsed = tryParseQrPayload(text);
        if (parsed) {
          e.preventDefault();
          setQrData(parsed);
          setQrRawText(text);
          setError(null);
          setTimeout(() => pinInputRef.current?.focus(), 60);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [step, decodeQrFromFile]);

  // Debounced French school search via data.education.gouv.fr + PRONOTE geolocation
  useEffect(() => {
    if (step !== 'pick') return;
    const q = schoolQuery.trim();
    if (q.length < 2 || /^https?:\/\//i.test(q)) {
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
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolQuery, step]);

  const handleSelectSchool = async (nameFallback: string, url: string) => {
    setError(null);
    setInspectingSchool(true);
    setSchoolResults([]);
    try {
      const info = await inspectWebPronoteInstance(url);
      setSelectedSchool({
        ...info,
        name: info.name || nameFallback,
      });
      if (info.casURL) {
        setStep('ent-qr');
      } else {
        setStep('direct');
      }
    } catch {
      const cleaned = url.replace(/\/$/, '');
      setSelectedSchool({
        name: nameFallback || cleaned,
        url: cleaned,
        eleveUrl: `${cleaned}/eleve.html`,
      });
      setStep('direct');
    } finally {
      setInspectingSchool(false);
    }
  };

  const handleDirectUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = schoolQuery.trim();
    if (/^https?:\/\//i.test(q) || q.includes('index-education.net')) {
      const fullUrl = /^https?:\/\//i.test(q) ? q : `https://${q}`;
      await handleSelectSchool(q, fullUrl);
    } else if (schoolResults.length === 1) {
      await handleSelectSchool(schoolResults[0].name, schoolResults[0].url);
    }
  };

  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Aucune caméra disponible sur ce navigateur. Utilise « Importer une capture » ou « Coller »."
      );
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
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
                  setTimeout(() => pinInputRef.current?.focus(), 60);
                  return;
                }
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError(
          "Aucune webcam/caméra détectée sur cet appareil. Fais simplement une capture d'écran (Win+Shift+S) puis clique sur « Coller » ou « Importer »."
        );
      } else {
        setCameraError(
          "Accès caméra refusé par le navigateur. Autorise la caméra ou utilise « Coller » / « Importer »."
        );
      }
      stopCamera();
    }
  };

  const handleClipboardButton = async () => {
    setError(null);
    setCameraError(null);
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            decodeQrFromFile(new File([blob], 'qr.png', { type: imgType }));
            return;
          }
        }
      }
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const parsed = tryParseQrPayload(text);
        if (parsed) {
          setQrData(parsed);
          setQrRawText(text);
          setTimeout(() => pinInputRef.current?.focus(), 60);
          return;
        }
      }
      setError(
        "Aucune capture QR Code dans ton presse-papiers. Fais d'abord Win + Shift + S sur le QR Code puis clique ici (ou Ctrl + V)."
      );
    } catch {
      setError('Appuie directement sur Ctrl + V pour coller ta capture d’écran.');
    }
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
      setError('Scanne, importe ou colle (Ctrl+V) d’abord ton QR Code PRONOTE.');
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
    if (!selectedSchool?.url) {
      setError("Sélectionne d'abord ton établissement.");
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
        url: selectedSchool.url,
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

  const resetToPicker = () => {
    stopCamera();
    setStep('pick');
    setSelectedSchool(null);
    setError(null);
    setQrData(null);
    setQrRawText('');
    setPin('');
    setPassword('');
  };

  const isUrlInput =
    /^https?:\/\//i.test(schoolQuery.trim()) || schoolQuery.trim().includes('index-education.net');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto obsidian-glow bg-[#060608] flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-7 sm:py-11 flex flex-col justify-center">
        {/* Hero Brand */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent/90 to-accent/35 border border-white/15 shadow-glow flex items-center justify-center mb-3.5">
            <span className="text-2xl font-black text-white leading-none">N</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connexion à Noctis Web
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-md mx-auto">
            Choisis ton lycée ou collège — Noctis détecte automatiquement la meilleure méthode de
            connexion.
          </p>
        </div>

        {/* Main Card */}
        <div
          onDragOver={(e) => {
            if (step === 'ent-qr' || step === 'quick-qr') {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (step === 'ent-qr' || step === 'quick-qr') {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith('image/')) {
                decodeQrFromFile(file);
              }
            }
          }}
          className={`rounded-3xl bg-[#0D0D14] border p-5 sm:p-6 shadow-2xl space-y-5 transition-colors ${
            dragOver ? 'border-accent ring-2 ring-accent/30' : 'border-white/[0.08]'
          }`}
        >
          {challenge ? (
            /* ===== 2FA CHALLENGE ===== */
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
          ) : step === 'pick' ? (
            /* ===== STEP 1: CHOOSE YOUR SCHOOL ===== */
            <div className="space-y-4">
              <form onSubmit={handleDirectUrlSubmit} className="space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-200">
                  1. Recherche ton collège ou lycée (nom, ville, code postal ou URL PRONOTE)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    value={schoolQuery}
                    onChange={(e) => {
                      setSchoolQuery(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ex : Lyon, 69001, Lycée Victor Hugo…"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#08080D] border border-white/[0.12] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
                  />
                  {searchingSchools || inspectingSchool ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  ) : schoolQuery.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSchoolQuery('');
                        setSchoolResults([]);
                      }}
                      className="text-zinc-500 hover:text-zinc-200 absolute right-3.5 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>

                {inspectingSchool && (
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/25 text-xs text-accent flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Détection du portail ENT / PRONOTE de ton établissement…</span>
                  </div>
                )}

                {isUrlInput && !inspectingSchool && (
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-accent text-black text-xs font-bold hover:opacity-90"
                  >
                    Continuer avec cette adresse PRONOTE →
                  </button>
                )}

                {schoolResults.length > 0 && !inspectingSchool && (
                  <div className="max-h-60 overflow-y-auto rounded-2xl bg-[#08080D] border border-white/[0.08] divide-y divide-white/[0.05]">
                    {schoolResults.map((s) => (
                      <button
                        key={s.url}
                        type="button"
                        onClick={() => handleSelectSchool(s.name, s.url)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-accent/10 flex items-center justify-between gap-2.5 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{s.name}</div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {s.postalCode} · {s.url.replace(/^https?:\/\//, '')}
                          </div>
                        </div>
                        <MapPin className="w-4 h-4 text-accent shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {schoolQuery.trim().length >= 2 &&
                  !isUrlInput &&
                  !searchingSchools &&
                  !inspectingSchool &&
                  schoolResults.length === 0 && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.06] text-xs text-zinc-400">
                      Aucun établissement PRONOTE trouvé pour « {schoolQuery.trim()} ». Essaie avec
                      le nom du lycée/collège ou son code postal.
                    </div>
                  )}
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-white/[0.07]" />
                <span className="px-3 text-[11px] text-zinc-500">ou</span>
                <div className="flex-1 border-t border-white/[0.07]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('quick-qr');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode className="w-4 h-4 text-accent" />
                <span>J'ai déjà mon QR Code PRONOTE</span>
              </button>
            </div>
          ) : step === 'ent-qr' || step === 'quick-qr' ? (
            /* ===== STEP 2A: ENT DETECTED -> OPEN ENT + INSTANT QR PASTE/UPLOAD/SCAN ===== */
            <form onSubmit={handleQrSubmit} className="space-y-4">
              {/* Top School Header + Back */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                <button
                  type="button"
                  onClick={resetToPicker}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Changer</span>
                </button>
                {selectedSchool ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <School className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-xs font-bold text-white truncate">
                      {selectedSchool.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-white inline-flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-accent" />
                    Connexion par QR Code
                  </span>
                )}
              </div>

              {/* Step 1: Open School ENT directly (when ENT school selected) */}
              {selectedSchool && (
                <div className="p-3.5 rounded-2xl bg-accent/[0.08] border border-accent/25 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      Étape 1 · Ouvre ton ENT ({selectedSchool.casHost || 'PRONOTE'})
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                      ENT détecté
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                    Connecte-toi sur ton ENT, clique sur l'icône{' '}
                    <strong className="text-white">QR Code</strong> en haut de PRONOTE et choisis 4
                    chiffres (ex. <code className="px-1 py-0.5 rounded bg-black/40">0000</code>).
                  </p>
                  <a
                    href={selectedSchool.eleveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-accent text-black text-xs font-bold flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-opacity"
                  >
                    <span>Ouvrir mon ENT / PRONOTE</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Step 2: Paste / Upload / Scan QR Code */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">
                    {selectedSchool ? 'Étape 2 · Donne le QR Code à Noctis' : 'QR Code PRONOTE'}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-accent">
                    <ClipboardPaste className="w-3 h-3" />
                    Ctrl+V accepté !
                  </span>
                </div>

                {!qrData ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={handleClipboardButton}
                        className="py-2.5 px-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/35 text-xs font-semibold text-white flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors"
                      >
                        <ClipboardPaste className="w-4 h-4 text-accent shrink-0" />
                        <span>Coller</span>
                      </button>
                      <label className="cursor-pointer py-2.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors">
                        <ImagePlus className="w-4 h-4 text-accent shrink-0" />
                        <span>Importer</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) decodeQrFromFile(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={cameraOpen ? stopCamera : startCamera}
                        className="py-2.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-accent shrink-0" />
                        <span>{cameraOpen ? 'Fermer' : 'Caméra'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-400 text-center hidden sm:block">
                      Astuce rapide sur PC : fais{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-200 font-mono text-[10px]">
                        Win + Shift + S
                      </kbd>{' '}
                      sur le QR Code puis{' '}
                      <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-200 font-mono text-[10px]">
                        Ctrl + V
                      </kbd>{' '}
                      directement ici (ou glisse l'image).
                    </p>

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

                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        onClick={() => setShowManualJson((v) => !v)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
                      >
                        {showManualJson ? 'Masquer JSON' : 'Coller le JSON manuellement'}
                      </button>
                      {selectedSchool && (
                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            setError(null);
                            setStep('direct');
                          }}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
                        >
                          Essayer par identifiants directs
                        </button>
                      )}
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
                          QR Code PRONOTE prêt !
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
              </div>

              {/* 4-digit PIN */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Code PIN à 4 chiffres choisi sur PRONOTE
                </label>
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Ex : 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080D] border border-white/[0.1] text-sm text-white tracking-[0.3em] font-semibold focus:outline-none focus:border-accent"
                />
              </div>

              {/* Remember me toggle (only scan QR Code ONCE on this device!) */}
              <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] cursor-pointer select-none">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-100">
                    Rester connecté sur cet appareil
                  </div>
                  <div className="text-[10.5px] text-zinc-400">
                    Tu ne fais le QR Code qu'une seule fois (décoche sur un PC partagé).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    setWebRememberMe(e.target.checked);
                  }}
                  className="w-4 h-4 accent-[rgb(var(--accent-rgb))] rounded shrink-0"
                />
              </label>

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
            /* ===== STEP 2B: NON-ENT SCHOOL -> DIRECT CREDENTIALS ===== */
            <form onSubmit={handleCredsSubmit} className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                <button
                  type="button"
                  onClick={resetToPicker}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Changer</span>
                </button>
                <div className="flex items-center gap-1.5 min-w-0">
                  <KeyRound className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-xs font-bold text-white truncate">
                    {selectedSchool?.name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Identifiant élève
                  </label>
                  <input
                    type="text"
                    autoFocus
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

              {error && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                    error.startsWith('ENT_REQUIRED::')
                      ? 'bg-amber-500/12 border-amber-400/35 text-amber-100'
                      : 'bg-rose-500/12 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {error.replace(/^ENT_REQUIRED::/, '')}
                    </span>
                  </div>
                  {error.startsWith('ENT_REQUIRED::') && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep('ent-qr');
                        setError(null);
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-accent text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-90"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Passer sur la connexion QR Code (ENT)
                    </button>
                  )}
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

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('ent-qr');
                  }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
                >
                  Ou me connecter par QR Code PRONOTE
                </button>
              </div>
            </form>
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
                Windows (.exe) & Android (.apk) avec connexion ENT automatique & mode hors ligne
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
              Aucun mot de passe stocké sur nos serveurs · Reconnexion locale uniquement sur ton appareil
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Client open-source non affilié à Index-Éducation (PRONOTE®)</span>
            <span>·</span>
            <a
              href="./legal.html"
              className="text-zinc-300 hover:text-white underline underline-offset-2"
            >
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
