import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

function initialsOf(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export function ChatPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);

  function loadChannels() {
    setLoadingChannels(true);
    api.get('/chat/channels').then((rows) => {
      setChannels(rows);
      if (!activeChannelId && rows.length > 0) setActiveChannelId(rows[0]._id);
    }).catch((err) => toast(err.message, 'error')).finally(() => setLoadingChannels(false));
  }
  useEffect(loadChannels, []);

  const activeChannel = channels.find((c) => c._id === activeChannelId);

  function channelLabel(c) {
    if (c.type === 'channel') return `# ${c.name}`;
    const other = c.memberIds.find((m) => m._id !== user._id);
    return other ? other.name : '(direct message)';
  }

  function channelInitials(c) {
    if (c.type === 'channel') return '#';
    const other = c.memberIds.find((m) => m._id !== user._id);
    return initialsOf(other?.name);
  }

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">Team messaging</p>
        <p className="page-title">Chat</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)]">
        <div className="card p-3 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-3 px-1">
            <p className="font-display font-bold text-sm text-ink">Channels</p>
            <div className="flex gap-3">
              <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setShowNewChannel(true)}>+ Channel</button>
              <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setShowNewDM(true)}>+ DM</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loadingChannels && <Loading />}
            {!loadingChannels && channels.length === 0 && <p className="text-xs text-ink-muted px-2">No channels yet — create one to get started.</p>}
            <div className="space-y-1">
              {channels.map((c) => {
                const isActive = c._id === activeChannelId;
                return (
                  <button
                    key={c._id}
                    onClick={() => setActiveChannelId(c._id)}
                    className={`w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors ${isActive ? 'bg-accent-soft text-accent-strong' : 'hover:bg-surface-sunken text-ink'}`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-accent text-white' : 'bg-accent-soft text-accent-strong'}`}>
                      {channelInitials(c)}
                    </span>
                    <span className="truncate flex-1 font-medium">{channelLabel(c)}</span>
                    {c.unreadCount > 0 && <span className="chip-accent text-[10px] px-1.5 shrink-0">{c.unreadCount}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card p-0 flex flex-col overflow-hidden">
          {!activeChannel && <EmptyState title="No channel selected" />}
          {activeChannel && <ChannelView channel={activeChannel} label={channelLabel(activeChannel)} onChannelsChanged={loadChannels} />}
        </div>
      </div>

      {showNewChannel && <NewChannelForm onClose={() => setShowNewChannel(false)} onSaved={(c) => { setShowNewChannel(false); loadChannels(); setActiveChannelId(c._id); }} />}
      {showNewDM && <NewDMForm onClose={() => setShowNewDM(false)} onSaved={(c) => { setShowNewDM(false); loadChannels(); setActiveChannelId(c._id); }} />}
    </div>
  );
}

function ChannelView({ channel, label, onChannelsChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [openThreadId, setOpenThreadId] = useState(null);
  const bottomRef = useRef(null);

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
  }, [channel._id]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/chat/channels/${channel._id}/messages`, { text });
      setText('');
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

  async function handleDelete(m) {
    if (!confirm('Delete this message?')) return;
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
        {!loading && messages.length === 0 && <p className="text-xs text-ink-muted">No messages yet — say hello.</p>}
        {messages.map((m) => {
          const isMine = m.senderId?._id === user._id;
          return (
            <div key={m._id} className="group flex gap-2.5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[11px] font-bold">
                {initialsOf(m.senderId?.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink">{m.senderId?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-ink-muted">{new Date(m.createdAt).toLocaleString()}</span>
                  {m.editedAt && <span className="text-[10px] text-ink-muted">(edited)</span>}
                  {m.pinned && <span className="chip-accent text-[10px] px-1.5">Pinned</span>}
                </div>
                <div className="inline-block mt-1 max-w-full rounded-2xl rounded-tl-sm bg-surface-sunken px-3.5 py-2">
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{m.text}</p>
                </div>
                <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-[11px] font-semibold text-accent hover:text-accent-strong" onClick={() => setOpenThreadId(openThreadId === m._id ? null : m._id)}>Reply</button>
                  <button className="text-[11px] font-semibold text-accent hover:text-accent-strong" onClick={() => togglePin(m)}>{m.pinned ? 'Unpin' : 'Pin'}</button>
                  {isMine && <button className="text-[11px] font-semibold text-danger hover:opacity-80" onClick={() => handleDelete(m)}>Delete</button>}
                </div>
                {openThreadId === m._id && <ThreadPanel rootMessage={m} channelId={channel._id} onSent={load} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-rule flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="Message… (use @Name to mention someone)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary">Send</button>
      </form>
    </>
  );
}

function ThreadPanel({ rootMessage, channelId, onSent }) {
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
        <input className="field-input flex-1 !py-1 !text-xs" placeholder="Reply in thread…" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={sending || !text.trim()} className="btn-secondary !py-1 !text-xs">Reply</button>
      </form>
    </div>
  );
}

function NewChannelForm({ onClose, onSaved }) {
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
      toast('Channel created.', 'success');
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
        <p className="font-display font-bold text-lg text-ink mb-4">New channel</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required className="field-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="field-label">Purpose (optional)</label><input className="field-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private channel</label>
          <div>
            <label className="field-label">Members</label>
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
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function NewDMForm({ onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [otherUserId, setOtherUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/users').then((rows) => setUsers(rows.filter((u) => u._id !== user._id))).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const channel = await api.post('/chat/channels/dm', { otherUserId });
      onSaved(channel);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display font-bold text-lg text-ink mb-4">New direct message</p>
        <select required className="field-input" value={otherUserId} onChange={(e) => setOtherUserId(e.target.value)}>
          <option value="">Select a person…</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !otherUserId} className="btn-primary">{saving ? 'Opening…' : 'Open'}</button>
        </div>
      </form>
    </div>
  );
}
