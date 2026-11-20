import React, { useState } from 'react';
import { ExternalLink, Check, AlertCircle, Lock, UserCheck, Trophy } from 'lucide-react';
import { API_BASE } from '../../config';

export interface NikoEmbedField {
  id?: string;
  name: string;
  value: string;
  inline?: boolean;
}

export interface NikoEmbedData {
  id?: string;
  color?: string;
  author?: {
    name: string;
    iconUrl?: string;
    url?: string;
  };
  title?: string;
  titleUrl?: string;
  description?: string;
  fields?: NikoEmbedField[];
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: {
    text: string;
    iconUrl?: string;
    timestamp?: boolean;
  };
  timestamp?: string;
}

export interface NikoComponentOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  roleId?: string;
}

export interface NikoComponent {
  type: 'button' | 'select';
  id: string;
  label?: string;
  emoji?: string;
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  url?: string;
  actionType:
    | 'role'
    | 'role_radio'
    | 'role_select'
    | 'ticket'
    | 'ticket_create'
    | 'ticket_close'
    | 'ticket_claim'
    | 'ticket_add_user'
    | 'verify'
    | 'giveaway'
    | 'poll_vote'
    | 'custom_link';
  targetId?: string;
  customId?: string;
  disabled?: boolean;
  placeholder?: string;
  options?: NikoComponentOption[];
}

export interface NikoActionRow {
  type: 'action_row';
  components: NikoComponent[];
}

interface NikoEmbedCardProps {
  embed: NikoEmbedData;
  spaceId?: string;
  channelId?: string;
}

export function NikoEmbedCard({ embed, spaceId, channelId }: NikoEmbedCardProps) {
  const accentColor = embed.color || '#5865F2';

  // Group fields into 3-column rows or standalone full rows
  const renderFields = () => {
    if (!embed.fields || embed.fields.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-2 text-xs">
        {embed.fields.map((field, idx) => (
          <div
            key={field.id || idx}
            className={`${field.inline ? 'col-span-1' : 'col-span-1 sm:col-span-3'} bg-black/20 p-2.5 rounded-xl border border-white/5`}
          >
            <div className="font-bold text-white/90 mb-1 tracking-wide">{field.name}</div>
            <div className="text-white/70 whitespace-pre-wrap break-words">{field.value}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="my-2 rounded-2xl overflow-hidden max-w-2xl bg-[#1e1f22]/90 border border-white/10 shadow-xl flex text-[var(--text-primary)]"
      style={{
        borderLeft: `5px solid ${accentColor}`,
        background: 'linear-gradient(135deg, rgba(30,31,34,0.96) 0%, rgba(20,21,24,0.98) 100%)'
      }}
    >
      <div className="p-4 flex-1 min-w-0">
        {/* Author */}
        {embed.author?.name && (
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-white/90">
            {embed.author.iconUrl && (
              <img
                src={embed.author.iconUrl}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            )}
            {embed.author.url ? (
              <a
                href={embed.author.url}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-[var(--app-accent)] flex items-center gap-1"
              >
                {embed.author.name}
                <ExternalLink className="w-3 h-3 inline" />
              </a>
            ) : (
              <span>{embed.author.name}</span>
            )}
          </div>
        )}

        <div className="flex gap-4 items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title */}
            {embed.title && (
              <div className="text-base font-bold text-white mb-1.5 leading-snug">
                {embed.titleUrl ? (
                  <a
                    href={embed.titleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-indigo-400 hover:text-indigo-300"
                  >
                    {embed.title}
                  </a>
                ) : (
                  embed.title
                )}
              </div>
            )}

            {/* Description */}
            {embed.description && (
              <div className="text-xs sm:text-sm text-white/80 whitespace-pre-wrap break-words leading-relaxed">
                {embed.description}
              </div>
            )}
          </div>

          {/* Thumbnail */}
          {embed.thumbnailUrl && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/30">
              <img
                src={embed.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* Dynamic Fields Grid */}
        {renderFields()}

        {/* Large Main Image */}
        {embed.imageUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-white/10 max-h-80 bg-black/40">
            <img
              src={embed.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Footer */}
        {(embed.footer?.text || embed.footer?.timestamp || embed.timestamp) && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5 text-[11px] text-white/50">
            {embed.footer?.iconUrl && (
              <img
                src={embed.footer.iconUrl}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            )}
            {embed.footer?.text && <span>{embed.footer.text}</span>}
            {(embed.footer?.timestamp || embed.timestamp) && (
              <>
                {embed.footer?.text && <span>•</span>}
                <time>
                  {embed.timestamp ? new Date(embed.timestamp).toLocaleString() : new Date().toLocaleString()}
                </time>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Interactive Component Rows (Buttons & Select Menus)
interface NikoActionRowsProps {
  rows: NikoActionRow[];
  spaceId: string;
  channelId?: string;
  onActionComplete?: (result: any) => void;
}

export function NikoActionRows({ rows, spaceId, channelId, onActionComplete }: NikoActionRowsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; ok: boolean } | null>(null);

  const handleInteract = async (comp: NikoComponent, selectedValues?: string[]) => {
    if (comp.disabled || loading) return;

    if (comp.style === 'link' && comp.url) {
      window.open(comp.url, '_blank', 'noopener,noreferrer');
      return;
    }

    setLoading(comp.id);
    setFeedback(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/spaces/${spaceId}/niko/interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionType: comp.actionType,
          targetId: comp.targetId,
          customId: comp.id,
          channelId,
          selectedValues
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Action failed');

      setFeedback({ id: comp.id, message: data.message || 'Success!', ok: true });
      if (onActionComplete) onActionComplete(data);
    } catch (err: any) {
      setFeedback({ id: comp.id, message: err.message || 'Failed', ok: false });
    } finally {
      setLoading(null);
    }
  };

  const getButtonClass = (style?: string) => {
    switch (style) {
      case 'primary':
        return 'bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-md active:scale-95';
      case 'success':
        return 'bg-[#248046] hover:bg-[#1A6334] text-white shadow-md active:scale-95';
      case 'danger':
        return 'bg-[#DA373C] hover:bg-[#A12828] text-white shadow-md active:scale-95';
      case 'link':
        return 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/15';
      case 'secondary':
      default:
        return 'bg-[#4E5058] hover:bg-[#6D6F78] text-white shadow-md active:scale-95';
    }
  };

  return (
    <div className="space-y-2 my-2 max-w-2xl">
      {rows.map((row, rIdx) => (
        <div key={rIdx} className="flex flex-wrap gap-2 items-center">
          {row.components.map(comp => {
            if (comp.type === 'select') {
              return (
                <div key={comp.id} className="w-full sm:w-80">
                  <select
                    disabled={loading === comp.id}
                    onChange={e => handleInteract(comp, [e.target.value])}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white focus:outline-none focus:border-[var(--app-accent)]"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {comp.placeholder || 'Select an option...'}
                    </option>
                    {(comp.options || []).map((opt, oIdx) => (
                      <option key={oIdx} value={opt.value}>
                        {opt.emoji ? `${opt.emoji} ` : ''}
                        {opt.label} {opt.description ? `— ${opt.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <button
                key={comp.id}
                type="button"
                disabled={loading === comp.id || comp.disabled}
                onClick={() => handleInteract(comp)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${getButtonClass(
                  comp.style
                )} disabled:opacity-50`}
              >
                {comp.emoji && <span className="text-sm">{comp.emoji}</span>}
                <span>{comp.label || 'Action'}</span>
                {comp.style === 'link' && <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />}
              </button>
            );
          })}
        </div>
      ))}

      {feedback && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
            feedback.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {feedback.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
}
