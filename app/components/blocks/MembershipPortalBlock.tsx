'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import { useMember } from '../membership/MemberProvider';
import {
  Lock, Users, Plus, Trash2, Type, Image as ImageIcon, Video, FileDown, Code,
  GripVertical, Settings, LogIn,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  type: 'text' | 'image' | 'video' | 'download' | 'embed';
  content: string;
  label?: string;
}

interface MembershipPortalBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MembershipPortalBlock({ id, data, isEditMode, palette, updateContent }: MembershipPortalBlockProps) {
  const context = useEditorContext();
  const siteId = context?.siteId;
  const memberCtx = useMember();

  const contentBlocks: ContentItem[] = data?.contentBlocks || [];
  const gateTitle: string = data?.gateTitle || 'Members Only Content';
  const gateMessage: string = data?.gateMessage || 'Sign in or create an account to access this content.';
  const allowedPackageIds: string[] = data?.allowedPackageIds || [];

  if (!siteId && isEditMode) {
    return <div className="py-12 text-center text-slate-400">Membership block requires a saved site.</div>;
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (isEditMode) {
    return (
      <EditModeView
        contentBlocks={contentBlocks}
        gateTitle={gateTitle}
        gateMessage={gateMessage}
        siteId={siteId!}
        palette={palette}
        updateContent={updateContent}
      />
    );
  }

  // ── Published mode — not authenticated ────────────────────────────────────
  if (!memberCtx?.member) {
    return (
      <GateView
        title={gateTitle}
        message={gateMessage}
        palette={palette}
      />
    );
  }

  // ── Published mode — authenticated but check package access ───────────────
  if (allowedPackageIds.length > 0 && memberCtx.member.packageId) {
    if (!allowedPackageIds.includes(memberCtx.member.packageId)) {
      return (
        <GateView
          title="Upgrade Required"
          message="Your current membership tier does not include access to this content. Please upgrade to view."
          palette={palette}
          showUpgrade
        />
      );
    }
  }

  // ── Published mode — authenticated and authorized ─────────────────────────
  return (
    <div className="py-8">
      {contentBlocks.length === 0 ? (
        <div className="text-center text-slate-400 py-8">
          No content has been added to this members area yet.
        </div>
      ) : (
        <div className="space-y-6">
          {contentBlocks.map((block) => (
            <ContentBlockRenderer key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gate View (unauthenticated/unauthorized) ───────────────────────────────

function GateView({
  title, message, palette, showUpgrade,
}: {
  title: string;
  message: string;
  palette: Record<string, string>;
  showUpgrade?: boolean;
}) {
  const primary = palette.primary || '#374151';

  return (
    <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: `${primary}10` }}
      >
        <Lock className="w-8 h-8" style={{ color: primary }} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
      <p className="text-slate-600 mb-6 max-w-md">{message}</p>
      <a
        href={showUpgrade ? '/member' : '/signin'}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        <LogIn className="w-4 h-4" />
        {showUpgrade ? 'View Membership Options' : 'Sign In / Sign Up'}
      </a>
    </div>
  );
}

// ─── Content Block Renderer (published) ─────────────────────────────────────

function ContentBlockRenderer({ block }: { block: ContentItem }) {
  switch (block.type) {
    case 'text':
      return (
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );
    case 'image':
      return (
        <div className="rounded-lg overflow-hidden">
          <img src={block.content} alt={block.label || 'Member content'} className="w-full" />
          {block.label && (
            <p className="text-sm text-slate-500 mt-2 text-center">{block.label}</p>
          )}
        </div>
      );
    case 'video':
      return (
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={block.content}
            className="w-full h-full"
            allowFullScreen
            title={block.label || 'Video'}
          />
        </div>
      );
    case 'download':
      return (
        <a
          href={block.content}
          download
          className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <FileDown className="w-5 h-5 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">
            {block.label || 'Download file'}
          </span>
        </a>
      );
    case 'embed':
      return (
        <div
          className="rounded-lg overflow-hidden"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );
    default:
      return null;
  }
}

// ─── Edit Mode View ─────────────────────────────────────────────────────────

function EditModeView({
  contentBlocks, gateTitle, gateMessage, siteId, palette, updateContent,
}: {
  contentBlocks: ContentItem[];
  gateTitle: string;
  gateMessage: string;
  siteId: string;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}) {
  const router = useRouter();
  const editorContext = useEditorContext();
  const requestNavigation = editorContext?.requestNavigation;
  const [showSettings, setShowSettings] = useState(false);

  const addContentBlock = (type: ContentItem['type']) => {
    const newBlock: ContentItem = {
      id: crypto.randomUUID(),
      type,
      content: '',
      label: '',
    };
    updateContent('contentBlocks', [...contentBlocks, newBlock]);
  };

  const updateContentBlock = (blockId: string, field: string, value: string) => {
    const updated = contentBlocks.map(b =>
      b.id === blockId ? { ...b, [field]: value } : b
    );
    updateContent('contentBlocks', updated);
  };

  const removeContentBlock = (blockId: string) => {
    updateContent('contentBlocks', contentBlocks.filter(b => b.id !== blockId));
  };

  return (
    <div className="py-8 px-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Members Only Content</h3>
            <p className="text-xs text-slate-500">This content is only visible to signed-in members</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            title="Gate settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const go = () => router.push(`/admin/membership?siteId=${siteId}`);
              if (requestNavigation) requestNavigation(go);
              else go();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Manage Members
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gate Title</label>
            <input
              type="text"
              value={gateTitle}
              onChange={e => updateContent('gateTitle', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gate Message</label>
            <textarea
              value={gateMessage}
              onChange={e => updateContent('gateMessage', e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Content blocks editor */}
      <div className="space-y-3 mb-4">
        {contentBlocks.map((block) => (
          <ContentBlockEditor
            key={block.id}
            block={block}
            onUpdate={updateContentBlock}
            onRemove={removeContentBlock}
          />
        ))}
      </div>

      {/* Add content block buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => addContentBlock('text')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Type className="w-3.5 h-3.5" />
          Text
        </button>
        <button
          onClick={() => addContentBlock('image')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Image
        </button>
        <button
          onClick={() => addContentBlock('video')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Video
        </button>
        <button
          onClick={() => addContentBlock('download')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          onClick={() => addContentBlock('embed')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          Embed
        </button>
      </div>
    </div>
  );
}

// ─── Content Block Editor (edit mode) ───────────────────────────────────────

function ContentBlockEditor({
  block, onUpdate, onRemove,
}: {
  block: ContentItem;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const typeLabels: Record<string, string> = {
    text: 'Text',
    image: 'Image URL',
    video: 'Video Embed URL',
    download: 'File URL',
    embed: 'HTML Embed',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    text: <Type className="w-3.5 h-3.5" />,
    image: <ImageIcon className="w-3.5 h-3.5" />,
    video: <Video className="w-3.5 h-3.5" />,
    download: <FileDown className="w-3.5 h-3.5" />,
    embed: <Code className="w-3.5 h-3.5" />,
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          {typeIcons[block.type]}
          {typeLabels[block.type]}
        </div>
        <button
          onClick={() => onRemove(block.id)}
          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {block.type === 'text' ? (
        <textarea
          value={block.content}
          onChange={e => onUpdate(block.id, 'content', e.target.value)}
          placeholder="Enter text content (HTML supported)..."
          rows={3}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
        />
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={block.content}
            onChange={e => onUpdate(block.id, 'content', e.target.value)}
            placeholder={`Enter ${typeLabels[block.type].toLowerCase()}...`}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
          />
          {(block.type === 'image' || block.type === 'download') && (
            <input
              type="text"
              value={block.label || ''}
              onChange={e => onUpdate(block.id, 'label', e.target.value)}
              placeholder="Label / caption (optional)"
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
            />
          )}
        </div>
      )}
    </div>
  );
}
