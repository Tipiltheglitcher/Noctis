import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  MessageSquare,
  Paperclip,
  ExternalLink,
  Send,
  Loader2,
  Inbox,
  Lock,
  CheckCircle2,
  ClipboardList,
  Check,
} from 'lucide-react';
import type {
  DiscussionSummaryDTO,
  DiscussionThreadDTO,
  NewsItemDTO,
} from '@shared/types';
import { formatDateFull, formatDateRelative, formatTime, sanitizeHtml } from '@/utils/format';
import { RightToDisconnectNote } from '../components/RightToDisconnectNote';

interface MessagesViewProps {
  news: NewsItemDTO[];
  discussions: DiscussionSummaryDTO[];
  loading: boolean;
  messagingDisabled?: boolean;
  onMarkNewsRead: (id: string) => void;
  onNewsDetailLoaded: (item: NewsItemDTO) => void;
  onRefreshAllMessages: () => Promise<void>;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  news,
  discussions,
  loading,
  messagingDisabled = false,
  onMarkNewsRead,
  onNewsDetailLoaded,
  onRefreshAllMessages,
}) => {
  const [subTab, setSubTab] = useState<'news' | 'discussions'>('news');
  const [newsFilter, setNewsFilter] = useState<'all' | 'information' | 'survey'>('all');
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [loadingNewsDetail, setLoadingNewsDetail] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [thread, setThread] = useState<DiscussionThreadDTO | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Interactive news/survey states
  const [acking, setAcking] = useState(false);
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [surveyDrafts, setSurveyDrafts] = useState<
    Record<string, { selectedAnswers?: number[]; textInputAnswer?: string }>
  >({});

  const filteredNews = useMemo(() => {
    if (newsFilter === 'all') return news;
    return news.filter((n) => n.is === newsFilter);
  }, [news, newsFilter]);

  const selectedNews =
    filteredNews.find((n) => n.id === selectedNewsId) || filteredNews[0] || null;
  const selectedDiscussion =
    discussions.find((d) => d.id === selectedDiscussionId) || discussions[0] || null;

  // Populate initial survey answers when selecting a survey or after detail loads
  useEffect(() => {
    if (!selectedNews || selectedNews.is !== 'survey' || !selectedNews.questions) return;
    const init: Record<string, { selectedAnswers?: number[]; textInputAnswer?: string }> = {};
    for (const q of selectedNews.questions) {
      init[q.id] = {
        selectedAnswers: q.selectedAnswers ? [...q.selectedAnswers] : [],
        textInputAnswer: q.textInputAnswer ?? '',
      };
    }
    setSurveyDrafts(init);
  }, [selectedNews?.id, selectedNews?.questions?.length]);

  // Lazy-load full message body / survey questions on Pronote 2026 (`tgra_DetailActu`)
  useEffect(() => {
    if (subTab !== 'news' || !selectedNews) return;
    if (!selectedNews.needsDetail) {
      if (!selectedNews.read) onMarkNewsRead(selectedNews.id);
      return;
    }

    let cancelled = false;
    setLoadingNewsDetail(true);
    window.pronoteAPI.data
      .getNewsDetail(selectedNews.id)
      .then((full) => {
        if (cancelled) return;
        if (full) {
          onNewsDetailLoaded(full);
          if (!full.read) onMarkNewsRead(full.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingNewsDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subTab, selectedNews?.id, selectedNews?.needsDetail, onMarkNewsRead, onNewsDetailLoaded]);

  useEffect(() => {
    if (subTab !== 'discussions' || !selectedDiscussion) return;
    let cancelled = false;
    setLoadingThread(true);
    window.pronoteAPI.data
      .getDiscussionMessages(selectedDiscussion.id)
      .then((res) => {
        if (!cancelled) setThread(res);
      })
      .catch(() => {
        if (!cancelled) setThread(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subTab, selectedDiscussion?.id]);

  const handleAcknowledge = async () => {
    if (!selectedNews || acking) return;
    setAcking(true);
    try {
      const ok = await window.pronoteAPI.data.acknowledgeNews(selectedNews.id);
      if (ok) await onRefreshAllMessages();
    } finally {
      setAcking(false);
    }
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNews || selectedNews.is !== 'survey' || !selectedNews.questions || submittingSurvey) {
      return;
    }
    setSubmittingSurvey(true);
    try {
      const payload = selectedNews.questions
        .filter((q) => q.kind === 1 || q.kind === 2 || q.kind === 3)
        .map((q) => ({
          questionId: q.id,
          selectedAnswers: surveyDrafts[q.id]?.selectedAnswers,
          textInputAnswer: surveyDrafts[q.id]?.textInputAnswer,
        }));
      const ok = await window.pronoteAPI.data.answerSurvey(selectedNews.id, payload);
      if (ok) await onRefreshAllMessages();
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscussion || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const ok = await window.pronoteAPI.data.sendDiscussionMessage(
        selectedDiscussion.id,
        replyText.trim()
      );
      if (ok) {
        setReplyText('');
        const updated = await window.pronoteAPI.data.getDiscussionMessages(selectedDiscussion.id);
        setThread(updated);
        await onRefreshAllMessages();
      }
    } finally {
      setSending(false);
    }
  };

  const unreadNews = news.filter((n) => !n.read).length;
  const unreadDiscussions = discussions.reduce((s, d) => s + d.numberOfMessagesUnread, 0);
  const surveyCount = news.filter((n) => n.is === 'survey').length;

  return (
    <div className="lg:h-full flex flex-col p-4 sm:p-5 lg:p-6 gap-4 animate-fade-in">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Informations, Sondages & Messages
          </h1>
          {loading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'news' && (
            <div className="p-1 rounded-xl bg-[#0D0D12] border border-white/[0.06] flex items-center gap-1 text-[11.5px]">
              {(
                [
                  { id: 'all', label: `Tout (${news.length})` },
                  { id: 'information', label: `Infos (${news.length - surveyCount})` },
                  { id: 'survey', label: `Sondages (${surveyCount})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setNewsFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    newsFilter === f.id
                      ? 'bg-white/[0.1] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-1 rounded-xl bg-[#0D0D12] border border-white/[0.06] flex items-center gap-1 text-xs">
            <button
              onClick={() => setSubTab('news')}
              className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                subTab === 'news'
                  ? 'bg-accent text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Infos & Sondages</span>
              {unreadNews > 0 && (
                <span className="px-1.5 rounded-full bg-black/20 text-[10.5px] font-bold">
                  {unreadNews}
                </span>
              )}
            </button>

            <button
              onClick={() => setSubTab('discussions')}
              className={`px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                subTab === 'discussions'
                  ? 'bg-accent text-black font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discussions</span>
              {unreadDiscussions > 0 && (
                <span className="px-1.5 rounded-full bg-black/20 text-[10.5px] font-bold">
                  {unreadDiscussions}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Droit à la déconnexion info */}
      <RightToDisconnectNote serverDisabled={messagingDisabled} className="shrink-0" />

      {/* Split Pane */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left List */}
        <div className="lg:col-span-4 max-h-[38vh] lg:max-h-none rounded-2xl bg-[#0C0C11] border border-white/[0.06] overflow-y-auto divide-y divide-white/[0.05]">
          {subTab === 'news' ? (
            filteredNews.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500">
                <Inbox className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                Aucune information ou sondage publié.
              </div>
            ) : (
              filteredNews.map((item) => {
                const active = selectedNews?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedNewsId(item.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      active ? 'bg-accent/12' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                        )}
                        <span className="text-[13.5px] font-semibold text-white truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        {formatDateRelative(item.creationDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-zinc-400">
                      <span className="truncate">{item.author}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {item.is === 'survey' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                            Sondage
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] text-zinc-400">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : discussions.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              <Inbox className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              Aucune discussion.
            </div>
          ) : (
            discussions.map((d) => {
              const active = selectedDiscussion?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDiscussionId(d.id)}
                  className={`w-full p-4 text-left transition-colors ${
                    active ? 'bg-accent/12' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {d.numberOfMessagesUnread > 0 && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      )}
                      <span className="text-[13.5px] font-semibold text-white truncate">
                        {d.subject}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      {formatDateRelative(d.date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-zinc-400">
                    <span className="truncate">{d.creator}</span>
                    <span className="text-[11px] text-zinc-500 shrink-0 ml-2">
                      {d.numberOfMessages} msg
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0D0D13] border border-white/[0.06] flex flex-col overflow-hidden">
          {subTab === 'news' ? (
            selectedNews ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="pb-4 border-b border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {selectedNews.is === 'survey' ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> Sondage
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent text-[11px] font-semibold">
                        Information
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 text-[11px]">
                      {selectedNews.category}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatDateFull(selectedNews.creationDate)}
                    </span>
                    {selectedNews.isAnonymous && (
                      <span className="text-[11px] text-zinc-400">· Réponse anonyme</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white">{selectedNews.title}</h2>
                  <p className="text-xs text-zinc-400 mt-1">De : {selectedNews.author}</p>
                </div>

                {/* Loading indicator while Pronote 2026 fetches detail */}
                {loadingNewsDetail && (
                  <div className="space-y-2.5 py-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                      <span>Chargement du message…</span>
                    </div>
                    <div className="h-4 w-5/6 rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-white/[0.04] animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                )}

                {/* Information Body */}
                {!loadingNewsDetail && selectedNews.is === 'information' && (
                  <>
                    <div
                      className="pronote-html"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNews.content) }}
                    />

                    {selectedNews.needToAcknowledge && (
                      <div className="pt-2">
                        {selectedNews.acknowledged ? (
                          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="w-4 h-4" />
                            Vous avez pris connaissance de cette information
                          </div>
                        ) : (
                          <button
                            onClick={handleAcknowledge}
                            disabled={acking}
                            className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                          >
                            {acking ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            J'ai pris connaissance
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Survey Interactive Body */}
                {!loadingNewsDetail && selectedNews.is === 'survey' && (
                  <form onSubmit={handleSubmitSurvey} className="space-y-4">
                    {(selectedNews.questions ?? []).map((q, idx) => {
                      const draft = surveyDrafts[q.id] ?? {
                        selectedAnswers: [],
                        textInputAnswer: '',
                      };
                      const isUnique = q.kind === 2;
                      const isMultiple = q.kind === 3;
                      const isText = q.kind === 1;

                      return (
                        <div
                          key={q.id || idx}
                          className="p-4 rounded-xl bg-[#13131C] border border-white/[0.06] space-y-3"
                        >
                          {(q.fullTitle || q.title) && (
                            <div className="text-sm font-semibold text-white">
                              {q.fullTitle || q.title}
                            </div>
                          )}
                          {q.content && (
                            <div
                              className="pronote-html text-[13px]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.content) }}
                            />
                          )}

                          {(isUnique || isMultiple) && q.choices.length > 0 && (
                            <div className="space-y-2 pt-1">
                              {q.choices.map((c) => {
                                const selected = (draft.selectedAnswers ?? []).includes(
                                  c.position
                                );
                                return (
                                  <button
                                    key={c.position}
                                    type="button"
                                    onClick={() => {
                                      setSurveyDrafts((prev) => {
                                        const cur = prev[q.id]?.selectedAnswers ?? [];
                                        let next: number[];
                                        if (isUnique) {
                                          next = [c.position];
                                        } else {
                                          next = cur.includes(c.position)
                                            ? cur.filter((x) => x !== c.position)
                                            : [...cur, c.position];
                                          if (
                                            q.shouldRespectMaximumChoices &&
                                            q.maximumChoices > 0 &&
                                            next.length > q.maximumChoices
                                          ) {
                                            next = next.slice(next.length - q.maximumChoices);
                                          }
                                        }
                                        return {
                                          ...prev,
                                          [q.id]: { ...prev[q.id], selectedAnswers: next },
                                        };
                                      });
                                    }}
                                    className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-xs flex items-center gap-3 transition-all ${
                                      selected
                                        ? 'bg-accent/15 border-accent/45 text-white font-medium'
                                        : 'bg-[#0C0C12] border-white/[0.06] text-zinc-300 hover:border-white/[0.14]'
                                    }`}
                                  >
                                    <span
                                      className={`w-4 h-4 ${
                                        isUnique ? 'rounded-full' : 'rounded'
                                      } border flex items-center justify-center shrink-0 ${
                                        selected
                                          ? 'bg-accent border-accent text-black'
                                          : 'border-zinc-600'
                                      }`}
                                    >
                                      {selected && <Check className="w-3 h-3" />}
                                    </span>
                                    <span>{c.value}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {(isText || q.choices.some((c) => c.isTextInput)) && (
                            <textarea
                              rows={3}
                              maxLength={q.maximumLength > 0 ? q.maximumLength : undefined}
                              value={draft.textInputAnswer ?? ''}
                              onChange={(e) =>
                                setSurveyDrafts((prev) => ({
                                  ...prev,
                                  [q.id]: { ...prev[q.id], textInputAnswer: e.target.value },
                                }))
                              }
                              placeholder="Votre réponse…"
                              className="w-full px-3 py-2 rounded-xl bg-[#0C0C12] border border-white/[0.08] focus:border-accent/60 focus:outline-none text-xs text-white placeholder:text-zinc-500"
                            />
                          )}
                        </div>
                      );
                    })}

                    {(selectedNews.questions ?? []).some((q) => q.shouldAnswer) && (
                      <button
                        type="submit"
                        disabled={submittingSurvey}
                        className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                      >
                        {submittingSurvey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        {(selectedNews.questions ?? []).some((q) => q.answered)
                          ? 'Mettre à jour mes réponses'
                          : 'Valider mes réponses'}
                      </button>
                    )}
                  </form>
                )}

                {selectedNews.attachments.length > 0 && (
                  <div className="pt-4 border-t border-white/[0.06] space-y-2">
                    <div className="text-xs font-semibold text-zinc-400">Pièces jointes</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedNews.attachments.map((att) => (
                        <button
                          key={att.id}
                          onClick={() => window.pronoteAPI.system.openExternal(att.url)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-zinc-200 inline-flex items-center gap-1.5"
                        >
                          {att.kind === 'link' ? (
                            <ExternalLink className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 text-accent" />
                          )}
                          <span>{att.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
                Sélectionnez une information ou un sondage à gauche.
              </div>
            )
          ) : selectedDiscussion ? (
            <>
              <div className="px-6 py-4 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">
                    {selectedDiscussion.subject}
                  </h2>
                  <p className="text-xs text-zinc-400 truncate">{selectedDiscussion.creator}</p>
                </div>
                {selectedDiscussion.closed && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-xs text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Fermée
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {loadingThread ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  </div>
                ) : (thread?.messages.length ?? 0) === 0 ? (
                  <div className="text-center text-xs text-zinc-500 py-12">
                    Aucun message dans cette conversation.
                  </div>
                ) : (
                  thread!.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border max-w-[85%] ${
                        m.isSelf
                          ? 'ml-auto bg-accent/15 border-accent/25'
                          : 'bg-[#14141C] border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px]">
                        <span className="font-semibold text-zinc-200">{m.authorName}</span>
                        <span className="text-zinc-500">
                          {formatDateRelative(m.creationDate)} · {formatTime(m.creationDate)}
                        </span>
                      </div>
                      <div
                        className="pronote-html"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content) }}
                      />
                      {m.files.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {m.files.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => window.pronoteAPI.system.openExternal(f.url)}
                              className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-[11px] text-zinc-200 inline-flex items-center gap-1"
                            >
                              <Paperclip className="w-3 h-3 text-accent" />
                              {f.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {thread?.canReply && (
                <form
                  onSubmit={handleSendReply}
                  className="p-3.5 border-t border-white/[0.06] bg-[#0A0A0F] flex items-center gap-2.5 shrink-0"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Écrire une réponse…"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#14141C] border border-white/[0.07] focus:border-accent/60 focus:outline-none text-sm text-white placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-accent text-black font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Envoyer</span>
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              Sélectionnez une discussion à gauche.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
