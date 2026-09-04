import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const REACTION_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙌', '😮', '✅'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function initialsOf(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function loadChannels() {
    setLoadingChannels(true);
    api.get('/chat/channels').then((rows) => {
      setChannels(rows);
      if (!activeChannelId && rows.length > 0) setActiveChannelId(rows[0]._id);
    }).catch((err) => toast(err.message, 'error')).finally(() => setLoadingChannels(false));
  }
  useEffect(loadChannels, []);

  const activeChannel = channels.find((c) => c._id === activeChannelId);
  const namedChannels = channels.filter((c) => c.type === 'channel');
  const dmChannels = channels.filter((c) => c.type === 'dm');

  function channelLabel(c) {
    if (c.type === 'channel') return `# ${c.name}`;
    const other = c.memberIds.find((m) => m._id !== user._id);
    return other ? other.name : t('chat.directMessage');
  }

  function channelInitials(c) {
    if (c.type === 'channel') return '#';
    const other = c.memberIds.find((m) => m._id !== user._id);
    return initialsOf(other?.name);
  }

  function goToChannel(channelId) {
    setSearchOpen(false);
    setActiveChannelId(channelId);
  }

  function SidebarRow({ c }) {
    const isActive = c._id === activeChannelId;
    return (
      <button
        onClick={() => goToChannel(c._id)}
        className={`w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors ${isActive ? 'bg-accent-soft text-accent-strong' : 'hover:bg-surface-sunken text-ink'}`}
      >
        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-accent text-white' : 'bg-accent-soft text-accent-strong'}`}>
          {channelInitials(c)}
        </span>
        <span className="truncate flex-1 font-medium">{channelLabel(c)}</span>
        {c.unreadCount > 0 && <span className="chip-accent text-[10px] px-1.5 shrink-0">{c.unreadCount}</span>}
      </button>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{t('chat.teamMessaging')}</p>
          <p className="page-title">{t('chat.chat')}</p>
        </div>
        <button className="btn-secondary text-xs" onClick={() => setSearchOpen(true)}>{t('chat.searchMessages')}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)]">
        <div className="card p-3 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loadingChannels && <Loading />}
            {!loadingChannels && channels.length === 0 && <p className="text-xs text-ink-muted px-2">{t('chat.noChannelsYetCreate')}</p>}

            <div className="flex justify-between items-center mb-2 px-1 mt-1">
              <p className="font-display font-bold text-sm text-ink">{t('chat.channels')}</p>
              <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setShowNewChannel(true)}>+ {t('chat.channel')}</button>
            </div>
            <div className="space-y-1 mb-4">
              {namedChannels.map((c) => <SidebarRow key={c._id} c={c} />)}
              {!loadingChannels && namedChannels.length === 0 && <p className="text-xs text-ink-muted px-2">{t('chat.noChannelsYet')}</p>}
            </div>

            <div className="flex justify-between items-center mb-2 px-1">
              <p className="font-display font-bold text-sm text-ink">{t('chat.directMessages')}</p>
              <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setShowNewDM(true)}>+ {t('chat.dm')}</button>
            </div>
            <div className="space-y-1">
              {dmChannels.map((c) => <SidebarRow key={c._id} c={c} />)}
              {!loadingChannels && dmChannels.length === 0 && <p className="text-xs text-ink-muted px-2">{t('chat.noDirectMessagesYet')}</p>}
            </div>
          </div>
        </div>

        <div className="card p-0 flex flex-col overflow-hidden">
          {!activeChannel && <EmptyState title={t('chat.noChannelSelected')} />}
          {activeChannel && <ChannelView channel={activeChannel} label={channelLabel(activeChannel)} onChannelsChanged={loadChannels} />}
        </div>
      </div>

      {showNewChannel && <NewChannelForm onClose={() => setShowNewChannel(false)} onSaved={(c) => { setShowNewChannel(false); loadChannels(); setActiveChannelId(c._id); }} />}
      {showNewDM && <NewDMForm onClose={() => setShowNewDM(false)} onSaved={(c) => { setShowNewDM(false); loadChannels(); setActiveChannelId(c._id); }} />}
      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} onJump={goToChannel} />}
    </div>
  );
}

function SearchPanel({ onClose, onJump }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const rows = await api.get(`/chat/search?q=${encodeURIComponent(q.trim())}`);
      setResults(rows);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function channelLabel(row) {
    if (!row.channel) return t('chat.unknownChannel');
    return row.channel.type === 'channel' ? `#${row.channel.name}` : t('chat.directMessage');
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-start justify-center z-40 px-4 pt-20">
      <div className="card p-5 w-full max-w-lg max-h-[70vh] flex flex-col">
        <p className="font-display font-bold text-lg text-ink mb-3">{t('chat.searchMessages')}</p>
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input autoFocus className="field-input flex-1" placeholder={t('chat.searchMessageTextPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={loading || !q.trim()} className="btn-primary">{loading ? t('chat.searching') : t('chat.search')}</button>
        </form>
        <div className="flex-1 overflow-y-auto space-y-2">
          {searched && !loading && results.length === 0 && <p className="text-xs text-ink-muted">{t('chat.noMessagesMatched')}</p>}
          {results.map((r) => (
            <button
              key={r._id}
              onClick={() => { onJump(r.channelId); onClose(); }}
              className="w-full text-left p-2.5 rounded-lg hover:bg-surface-sunken border border-rule"
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-accent-strong">{channelLabel(r)}</span>
                <span className="text-xs font-semibold text-ink">{r.senderId?.name}</span>
                <span className="text-[10px] text-ink-muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-ink truncate">{r.text}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-muted mt-2">{t('chat.jumpingNote')}</p>
        <div className="flex justify-end mt-3">
          <button className="btn-secondary" onClick={onClose}>{t('chat.close')}</button>
        </div>
      </div>
    </div>
  );
}

function ChannelView({ channel, label, onChannelsChanged }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [openReactionsId, setOpenReactionsId] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get(`/chat/channels/${channel._id}/messages`).then((rows) => {
      setMessages(rows);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 0);
    }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.post(`/chat/channels/${channel._id}/read`).then(onChannelsChanged).catch(() => {});
    setPendingFile(null);
  }, [channel._id]);

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast(t('chat.fileTooLarge', { size: (file.size / (1024 * 1024)).toFixed(1) }), 'error');
      return;
    }
    const fileData = await fileToDataUri(file);
    setPendingFile({ fileName: file.name, fileData, mimeType: file.type || 'application/octet-stream', fileSizeBytes: file.size });
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    try {
      await api.post(`/chat/channels/${channel._id}/messages`, {
        text: text.trim() || (pendingFile ? t('chat.sharedAFile', { name: pendingFile.fileName }) : ''),
        attachments: pendingFile ? [pendingFile] : undefined,
      });
      setText('');
      setPendingFile(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function togglePin(m) {
    try {
      await api.post(`/chat/messages/${m._id}/${m.pinned ? 'unpin' : 'pin'}`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleReaction(m, emoji) {
    try {
      await api.post(`/chat/messages/${m._id}/reactions`, { emoji });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete(m) {
    if (!confirm(t('chat.confirmDeleteMessage'))) return;
    try { await api.del(`/chat/messages/${m._id}`); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-rule flex items-center gap-3">
        <span className="shrink-0 w-9 h-9 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-xs font-bold">
          {label.startsWith('#') ? '#' : initialsOf(label)}
        </span>
        <div>
          <p className="font-display font-bold text-sm text-ink">{label}</p>
          {channel.purpose && <p className="text-xs text-ink-muted mt-0.5">{channel.purpose}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && <Loading />}
        {!loading && messages.length === 0 && <p className="text-xs text-ink-muted">{t('chat.noMessagesYet')}</p>}
        {messages.map((m) => {
          const isMine = m.senderId?._id === user._id;
          return (
            <div key={m._id} className="group flex gap-2.5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[11px] font-bold">
                {initialsOf(m.senderId?.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink">{m.senderId?.name || t('chat.unknown')}</span>
                  <span className="text-[10px] text-ink-muted">{new Date(m.createdAt).toLocaleString()}</span>
                  {m.editedAt && <span className="text-[10px] text-ink-muted">({t('chat.edited')})</span>}
                  {m.pinned && <span className="chip-accent text-[10px] px-1.5">{t('chat.pinned')}</span>}
                </div>
                <div className="inline-block mt-1 max-w-full rounded-2xl rounded-tl-sm bg-surface-sunken px-3.5 py-2">
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{m.text}</p>
                  {(m.attachments || []).map((a, i) => (
                    <a
                      key={i}
                      href={a.fileData}
                      download={a.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface border border-rule text-xs font-semibold text-accent-strong hover:bg-accent-soft w-fit"
                    >
                      📎 {a.fileName}
                      {a.fileSizeBytes != null && <span className="text-ink-muted font-normal">({(a.fileSizeBytes / 1024).toFixed(0)} KB)</span>}
                    </a>
                  ))}
                </div>

                {(m.reactions || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.reactions.map((r) => {
                      const mine = r.userIds.some((id) => (id?._id || id) === user._id);
                      return (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(m, r.emoji)}
                          className={`text-xs px-1.5 py-0.5 rounded-full border ${mine ? 'bg-accent-soft border-accent text-accent-strong' : 'bg-surface-sunken border-rule text-ink'}`}
                        >
                          {r.emoji} {r.userIds.length}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                  <button className="text-[11px] font-semibold text-accent hover:text-accent-strong" onClick={() => setOpenThreadId(openThreadId === m._id ? null : m._id)}>{t('chat.reply')}</button>
                  <button className="text-[11px] font-semibold text-accent hover:text-accent-strong" onClick={() => setOpenReactionsId(openReactionsId === m._id ? null : m._id)}>{t('chat.react')}</button>
                  <button className="text-[11px] font-semibold text-accent hover:text-accent-strong" onClick={() => togglePin(m)}>{m.pinned ? t('chat.unpin') : t('chat.pin')}</button>
                  {isMine && <button className="text-[11px] font-semibold text-danger hover:opacity-80" onClick={() => handleDelete(m)}>{t('chat.delete')}</button>}
                  {openReactionsId === m._id && (
                    <div className="absolute top-5 left-0 z-10 card p-1.5 flex gap-1 shadow-md">
                      {REACTION_EMOJI.map((emoji) => (
                        <button key={emoji} className="text-base hover:scale-125 transition-transform" onClick={() => { toggleReaction(m, emoji); setOpenReactionsId(null); }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {openThreadId === m._id && <ThreadPanel rootMessage={m} channelId={channel._id} onSent={load} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {pendingFile && (
        <div className="px-3 pt-2 flex items-center gap-2 text-xs text-ink-muted">
          <span className="chip">{pendingFile.fileName}</span>
          <button type="button" className="text-danger font-semibold" onClick={() => setPendingFile(null)}>{t('chat.remove')}</button>
        </div>
      )}
      <form onSubmit={handleSend} className="p-3 border-t border-rule flex gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
        <button type="button" className="btn-secondary shrink-0" title={t('chat.attachAFile')} onClick={() => fileInputRef.current?.click()}>📎</button>
        <input
          className="field-input flex-1"
          placeholder={t('chat.messagePlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || (!text.trim() && !pendingFile)} className="btn-primary">{t('chat.send')}</button>
      </form>
    </>
  );
}

function ThreadPanel({ rootMessage, channelId, onSent }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    api.get(`/chat/messages/${rootMessage._id}/thread`).then(setReplies).catch(() => {});
  }
  useEffect(load, [rootMessage._id]);

  async function handleReply(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/chat/channels/${channelId}/messages`, { text, replyToMessageId: rootMessage._id });
      setText('');
      load();
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ml-2 mt-2 pl-3 border-l-2 border-rule-strong space-y-2">
      {replies.map((r) => (
        <div key={r._id} className="flex gap-2">
          <span className="shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[9px] font-bold">
            {initialsOf(r.senderId?.name)}
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-ink">{r.senderId?.name}</span>
              <span className="text-[10px] text-ink-muted">{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-xs text-ink">{r.text}</p>
          </div>
        </div>
      ))}
      <form onSubmit={handleReply} className="flex gap-2">
        <input className="field-input flex-1 !py-1 !text-xs" placeholder={t('chat.replyInThreadPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={sending || !text.trim()} className="btn-secondary !py-1 !text-xs">{t('chat.reply')}</button>
      </form>
    </div>
  );
}

function NewChannelForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/users').then(setUsers).catch(() => {}); }, []);

  function toggleMember(id) {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const channel = await api.post('/chat/channels', { name, purpose, isPrivate, memberIds });
      toast(t('chat.channelCreated'), 'success');
      onSaved(channel);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display font-bold text-lg text-ink mb-4">{t('chat.newChannel')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('chat.name')}</label><input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="field-label">{t('chat.purposeOptional')}</label><input className="field-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> {t('chat.privateChannel')}</label>
          <div>
            <label className="field-label">{t('chat.members')}</label>
            <div className="max-h-32 overflow-y-auto border border-rule-strong rounded-lg p-2 space-y-1">
              {users.map((u) => (
                <label key={u._id} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={memberIds.includes(u._id)} onChange={() => toggleMember(u._id)} /> {u.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('chat.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('chat.creating') : t('chat.create')}</button>
        </div>
      </form>
    </div>
  );
}

function NewDMForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [otherUserId, setOtherUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/users').then((rows) => setUsers(rows.filter((u) => u._id !== user._id))).catch(() => {}); }, []);

  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function startDM(userId) {
    setOtherUserId(userId);
    setSaving(true);
    try {
      const channel = await api.post('/chat/channels/dm', { otherUserId: userId });
      onSaved(channel);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-xs">
        <p className="font-display font-bold text-lg text-ink mb-4">{t('chat.newDirectMessage')}</p>
        <input
          autoFocus
          className="field-input mb-2"
          placeholder={t('chat.searchPeoplePlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-48 overflow-y-auto -mx-1 px-1 space-y-1">
          {filtered.map((u) => (
            <button
              key={u._id}
              disabled={saving}
              onClick={() => startDM(u._id)}
              className="w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2.5 hover:bg-surface-sunken text-ink disabled:opacity-50"
            >
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[10px] font-bold">
                {initialsOf(u.name)}
              </span>
              <span className="truncate">{u.name}</span>
              {saving && otherUserId === u._id && <span className="text-[10px] text-ink-muted ml-auto">{t('chat.opening')}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-ink-muted px-2 py-1">{t('chat.noMatchingPeople')}</p>}
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('chat.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
