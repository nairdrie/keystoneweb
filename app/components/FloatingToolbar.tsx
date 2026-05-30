'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, Plus, RotateCcw, RotateCw, Pencil, Sparkles, Settings, Trash2, Share2, Check as CheckIcon, History, Paintbrush, LayoutDashboard, X, HelpCircle, BookOpen, Eye, EyeOff, Image as ImageIcon, Tablet, Smartphone, Monitor, Layout, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import KeystoneLogo from './KeystoneLogo';
import { Change } from '@/lib/hooks/useChangeTracking';
import AlertModal from './ui/AlertModal';
import FontPickerModal from './FontPickerModal';
import AIBuilderPanel from './AIBuilderPanel';
import TranslationsPanel from './TranslationsPanel';
import ImageEditorModal from './ImageEditorModal';
import EditHistoryModal from './EditHistoryModal';
import DoctorPanel from './DoctorPanel';
import SiteAnimationControls from './SiteAnimationControls';
import {
  DEFAULT_SITE_LAYOUT_CONTAINER_WIDTH,
  SITE_LAYOUT_CONTAINER_WIDTH_KEY,
  SITE_LAYOUT_CONTAINER_WIDTH_OPTIONS,
  normalizeSiteLayoutContainerWidth,
  type SiteLayoutContainerWidth,
} from '@/lib/site-layout';
import { AIMessage, UsageRemaining } from '@/lib/hooks/useAIBuilder';
import { Type, User, Languages, Stethoscope } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import WalkthroughModal, { WalkthroughStep } from './WalkthroughModal';
import SiteLimitModal from './SiteLimitModal';

interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

type PaletteColorType = 'primary' | 'secondary' | 'accent';

type CustomColorChangeOptions = {
  commit?: boolean;
};

interface Site {
  id: string;
  siteSlug?: string;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  isPublished?: boolean;
}

interface FloatingToolbarProps {
  siteTitle: string;
  onSiteTitle: (title: string) => void;
  siteContent?: any;
  onUpdateSiteContent?: (key: string, value: any) => void;
  currentSiteId?: string;
  templateName?: string;
  templateThumbnailUrl?: string;
  templateDescription?: string;
  templatePalettes?: Palette[];
  selectedPalette?: Palette;
  onSelectPalette?: (palette: Palette) => void;
  onCustomColorChange?: (type: PaletteColorType, value: string, options?: CustomColorChangeOptions) => void;
  logoUrl?: string;
  onLogoChange?: (url: string) => void;
  uploadImage?: (file: File, contentKey: string) => Promise<string>;
  siteCategory?: string;
  titleFont?: string;
  onTitleFontChange?: (font: string) => void;
  bodyFont?: string;
  onBodyFontChange?: (font: string) => void;
  onSave: () => void;
  onPublish?: () => void;
  onPublishSuccess?: () => void;
  saving?: boolean;
  publishing?: boolean;
  changes?: Change[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isPublished?: boolean;
  publishedDomain?: string;
  customDomain?: string;
  pendingCustomDomain?: string;
  isSynced?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode?: boolean;
  // AI Builder
  aiMessages?: AIMessage[];
  aiIsLoading?: boolean;
  aiProgressMessage?: string | null;
  onAiSend?: (message: string) => void;
  onAiCancel?: () => void;
  onAiClear?: () => void;
  isProUser?: boolean;
  isBasicUser?: boolean;
  isFreeUser?: boolean;
  showAiUpgradeModal?: boolean;
  onDismissAiUpgradeModal?: () => void;
  aiRemaining?: UsageRemaining | null;
  focusAiBuilder?: boolean;
  onHistoryRevert?: () => void;
  currentPageSlug?: string;
}

function getFreeAiBadgeLabel(remaining: UsageRemaining | null | undefined) {
  if (remaining?.total === undefined) return 'Free';
  const promptsLeft = Math.max(0, remaining.total);
  return `${promptsLeft} Free left`;
}

const LG_BREAKPOINT = 1024;
const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';

function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    setIsLarge(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isLarge;
}

export default function FloatingToolbar({
  siteTitle,
  onSiteTitle,
  siteContent = {},
  onUpdateSiteContent = () => { },
  currentSiteId,
  templateName,
  templateThumbnailUrl,
  templateDescription,
  templatePalettes = [],
  selectedPalette,
  onSelectPalette,
  onCustomColorChange,
  logoUrl,
  onLogoChange,
  uploadImage,
  siteCategory,
  titleFont,
  onTitleFontChange,
  bodyFont,
  onBodyFontChange,
  onSave,
  onPublish,
  onPublishSuccess,
  saving = false,
  publishing = false,
  changes = [],
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isPublished = false,
  publishedDomain,
  customDomain,
  pendingCustomDomain,
  isSynced = false,
  isOpen,
  onOpenChange,
  isEditMode = false,
  aiMessages = [],
  aiIsLoading = false,
  aiProgressMessage = null,
  onAiSend,
  onAiCancel,
  onAiClear,
  isProUser = false,
  isBasicUser = false,
  isFreeUser = false,
  showAiUpgradeModal = false,
  onDismissAiUpgradeModal,
  aiRemaining,
  focusAiBuilder = false,
  onHistoryRevert,
  currentPageSlug = '',
}: FloatingToolbarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isLargeScreen = useIsLargeScreen();
  const freeAiPromptsLeft = aiRemaining?.total;
  const freeAiBadgeLabel = getFreeAiBadgeLabel(aiRemaining);

  const [userSites, setUserSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [publishLimitInfo, setPublishLimitInfo] = useState<{ plan: string; limit: number } | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [activeLogoModal, setActiveLogoModal] = useState<'shared' | 'header' | 'footer' | 'favicon' | null>(null);
  const [headerLogoResponsiveOpen, setHeaderLogoResponsiveOpen] = useState(() =>
    Boolean(siteContent?.headerLogoHeightMd || siteContent?.headerLogoHeightSm)
  );
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'info' | 'warning', onConfirm?: () => void, confirmLabel?: string, cancelLabel?: string }>({ isOpen: false, message: '' });
  const [isPublishingUpdates, setIsPublishingUpdates] = useState(false);
  const isFullyDeployed = isSynced && changes.length === 0;
  const selectedContainerWidth = normalizeSiteLayoutContainerWidth(siteContent?.[SITE_LAYOUT_CONTAINER_WIDTH_KEY]);

  const [openSections, setOpenSections] = useState<string[]>([]);
  const openSectionsRef = useRef<string[]>([]);
  const [fontPickerState, setFontPickerState] = useState<{ isOpen: boolean, type: 'title' | 'body' }>({ isOpen: false, type: 'title' });
  const aiBuilderSectionRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferIncludeDomain, setTransferIncludeDomain] = useState(false);
  const [isSendingTransfer, setIsSendingTransfer] = useState(false);
  const [transferSent, setTransferSent] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isRenamingSite, setIsRenamingSite] = useState(false);
  const [siteTitleDraft, setSiteTitleDraft] = useState('');
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughStyleBaseline, setWalkthroughStyleBaseline] = useState<{
    paletteName: string;
    titleFont: string;
    bodyFont: string;
  } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false);
  const walkthroughPanelStateRef = useRef<boolean | null>(null);
  const walkthroughOpenSectionsRef = useRef<string[] | null>(null);
  const walkthroughAutoOpenedRef = useRef(false);

  const DESIGNER_WALKTHROUGH_KEY = 'ks_seen_designer_walkthrough';
  const ALWAYS_SHOW_DESIGNER_WALKTHROUGH = false;
  const COLORS_FONTS_CONTROLS_STEP_INDEX = 6;

  const hasChangedColorsOrFonts = walkthroughStyleBaseline
    ? (
        (selectedPalette?.name || 'custom') !== walkthroughStyleBaseline.paletteName ||
        (titleFont || '') !== walkthroughStyleBaseline.titleFont ||
        (bodyFont || '') !== walkthroughStyleBaseline.bodyFont
      )
    : false;

  const designerSteps = useMemo<WalkthroughStep[]>(() => {
    const isViewingAnotherPage = currentPageSlug !== 'home';

    return [
    {
      title: 'Welcome to Keystone Design Studio',
      description: 'This quick tour will show you how to switch into editing mode, update content, shape the look of your site, and publish when everything feels right. You can try things out as we go.',
      placement: 'center',
    },
    {
      target: '[data-tour="builder-edit-toggle"]',
      title: 'Switch into edit mode',
      placement: 'bottom',
      description: 'Start here by switching from View to Edit. View shows the page like a visitor would see it, while Edit turns on the site-building tools.',
      spotlightPadding: 6,
      spotlightRadiusOffset: 8,
      interactionHint: 'Try switching to Edit to unlock the next step.',
    },
    {
      target: '[data-tour="builder-canvas"]',
      title: 'Click anything to edit',
      placement: 'bottom',
      description: 'Once you are in Edit mode, click directly on text, images, and buttons in the preview to update them in place.',
      interactionHint: 'Feel free to click around in the highlighted area, then continue when you are ready.',
    },
    {
      target: '[data-tour="builder-section-frame"]',
      title: 'Add & rearrange sections',
      description: 'Hover over a section to reveal controls for moving, duplicating, or removing it. Use the add controls in the canvas to build out the page.',
      placement: 'bottom',
      spotlightPadding: 10,
      controlPreviews: [
        { icon: 'plus', label: 'Add section' },
        { icon: 'settings', label: 'Section settings' },
        { icon: 'up', label: 'Move up' },
        { icon: 'down', label: 'Move down' },
        { icon: 'trash', label: 'Delete section' },
      ],
      interactionHint: 'You can hover and explore section controls while this step is open.',
    },
    {
      target: isViewingAnotherPage
        ? '[data-tour="builder-canvas"]'
        : ['[data-tour="page-selector-menu"]', '[data-tour="page-selector-trigger"]'],
      title: 'Pages & page switching',
      description: isViewingAnotherPage
        ? 'Perfect. You are now on another page, and this canvas works just like your Home page while you build.'
        : 'Use the page menu in the top-left to switch between pages while building. You can also add a new page here whenever you need one, like Services, About, or Contact.',
      placement: 'bottom',
      autoMinimizeOnObstruction: false,
      interactionHint: isViewingAnotherPage
        ? 'Take a quick look around this page, then continue when you are ready.'
        : 'Pick another page here, or create a new one, to continue the tour.',
    },
    {
      target: ['[data-tour="page-selector-home-option"]', '[data-tour="page-selector-menu"]', '[data-tour="page-selector-trigger"]'],
      title: 'Return to Home',
      description: 'Nice. Use this same page menu to jump back to Home before we move on to styling the main design.',
      placement: 'bottom',
      autoMinimizeOnObstruction: false,
      interactionHint: 'Select Home in the page menu to unlock the next step.',
      },
      {
        target: ['[data-tour="font-picker-modal"]', '[data-tour="builder-design-panel"]'],
        title: 'Colors & fonts',
        description: 'Open the Design panel to pick a color palette and choose fonts that match your brand.',
        placement: 'right',
        autoMinimizeOnObstruction: false,
        requiresPanel: true,
        sectionKeys: ['colors', 'typography'],
        interactionHint: 'Try choosing a new palette or font here to continue the tour.',
      },
      {
        target: '[data-tour="builder-canvas"]',
        title: 'See your style changes',
        description: 'Nice. Now you can look over the full page and see how your updated colors and fonts change the feel of the site in context.',
        placement: 'bottom',
        interactionHint: 'Take a moment to look around the page, then continue when you are ready.',
      },
      {
        target: '[data-tour="builder-ai-builder"]',
      title: 'AI Builder',
      description: 'Stuck on building? Open the AI Builder panel to help shape your website, generate sections, refine content, and move faster when you are not sure what to do next.',
      placement: 'right',
      requiresPanel: true,
      sectionKeys: ['ai-builder'],
      interactionHint: 'This panel stays usable during the tour, so you can poke around before continuing.',
    },
      {
        target: isEditMode ? '[data-tour="builder-edit-toggle"]' : '[data-tour="builder-canvas"]',
        title: 'Preview your site',
        description: isEditMode
          ? 'When you are ready to preview your work, switch from Edit to View.'
          : 'Now you are in View mode. Look around your site, click through it, and experience it the way a visitor would.',
        placement: 'bottom',
        interactionHint: isEditMode
          ? 'Use this toggle anytime you want to preview the site, then switch back to Edit to keep building.'
          : 'Take a moment to look around your site here, then continue when you are ready.',
        spotlightPadding: 6,
        spotlightRadiusOffset: 8,
      },
        {
        target: '[data-tour="builder-save-actions"]',
        title: 'Save & Publish',
        description: 'Hit Save to keep your progress, then Publish when you\'re ready for the world to see your site.',
        placement: 'right',
        requiresPanel: true,
        interactionHint: 'When you are comfortable with your changes, these are the controls you will use to keep or launch them.',
        },
        {
        target: '[data-tour="builder-help-button"]',
        title: 'Need help later?',
        description: 'If you ever want to revisit this guide or open block documentation, look for the help button in the bottom-right corner and choose the option you need.',
        placement: 'left',
        autoMinimizeOnObstruction: false,
        animateFinishToTarget: true,
        interactionHint: 'Finish the tour and watch it tuck itself back into that help button.',
        },
        ];
      }, [currentPageSlug, isEditMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (walkthroughAutoOpenedRef.current) return;

    // Suppress the designer walkthrough for launch-service clients. The flag is
    // set on their profile when they claim the onboarding token; we expose it
    // to the page via a body data attribute so this effect doesn't have to
    // wait for an API roundtrip.
    const suppressForLaunchClient =
      document.body.dataset.suppressDesignerWalkthrough === '1' ||
      new URLSearchParams(window.location.search).has('launchToken');
    if (suppressForLaunchClient) return;

    if (ALWAYS_SHOW_DESIGNER_WALKTHROUGH || !localStorage.getItem(DESIGNER_WALKTHROUGH_KEY)) {
      walkthroughAutoOpenedRef.current = true;
      setShowWalkthrough(true);
    }
  }, [ALWAYS_SHOW_DESIGNER_WALKTHROUGH]);

  function handleCloseWalkthrough() {
    closeWalkthroughTransientUi();
      if (typeof window !== 'undefined') {
        localStorage.setItem(DESIGNER_WALKTHROUGH_KEY, '1');
      }
      setShowWalkthrough(false);
      setWalkthroughStep(0);
      setWalkthroughStyleBaseline(null);
      if (walkthroughPanelStateRef.current !== null) {
        onOpenChange(walkthroughPanelStateRef.current);
        walkthroughPanelStateRef.current = null;
    }
    if (walkthroughOpenSectionsRef.current) {
      setOpenSections(walkthroughOpenSectionsRef.current);
      walkthroughOpenSectionsRef.current = null;
    }
  }

  function openWalkthrough() {
    setWalkthroughStep(0);
    setWalkthroughStyleBaseline(null);
    setShowWalkthrough(true);
  }

  function closeWalkthroughTransientUi() {
    window.dispatchEvent(new CustomEvent(WALKTHROUGH_RESET_EVENT));
    setFontPickerState((prev) => prev.isOpen ? { ...prev, isOpen: false } : prev);
    setActiveLogoModal(null);
    setShowHistoryModal(false);
    setShowPreviewModal(false);
    setShowSiteSwitcher(false);
  }

  function handleNextWalkthrough() {
    closeWalkthroughTransientUi();
    setWalkthroughStep((step) => Math.min(step + 1, designerSteps.length - 1));
  }

  function handlePrevWalkthrough() {
    closeWalkthroughTransientUi();
    setWalkthroughStep((step) => Math.max(step - 1, 0));
  }

  const toggleSection = (section: string) => {
    setOpenSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]);
  };

  useEffect(() => {
    openSectionsRef.current = openSections;
  }, [openSections]);

  // When focusAiBuilder fires, collapse others, expand AI builder, and scroll to it
  useEffect(() => {
    if (!focusAiBuilder) return;
    setOpenSections(['ai-builder']);
    // Scroll to the AI builder section after a tick for the DOM to update
    setTimeout(() => {
      aiBuilderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [focusAiBuilder]);

  useEffect(() => {
    if (!showWalkthrough) return;

    if (walkthroughPanelStateRef.current === null) {
      walkthroughPanelStateRef.current = isOpen;
    }

    if (walkthroughOpenSectionsRef.current === null) {
      walkthroughOpenSectionsRef.current = openSectionsRef.current;
    }

    const activeStep = designerSteps[walkthroughStep];
    if (!activeStep) return;

    if (!isLargeScreen) {
      onOpenChange(Boolean(activeStep.requiresPanel));
    } else if (activeStep.requiresPanel && !isOpen) {
      onOpenChange(true);
    }

    if (activeStep.sectionKeys?.length) {
      setOpenSections((prev) => {
        const next = Array.from(new Set([...prev, ...activeStep.sectionKeys!]));
        return next.length === prev.length && next.every((key, index) => key === prev[index])
          ? prev
          : next;
      });
    }
  }, [designerSteps, isLargeScreen, isOpen, onOpenChange, showWalkthrough, walkthroughStep]);

  useEffect(() => {
    if (!showWalkthrough || walkthroughStep !== COLORS_FONTS_CONTROLS_STEP_INDEX || walkthroughStyleBaseline) return;

    setWalkthroughStyleBaseline({
      paletteName: selectedPalette?.name || 'custom',
      titleFont: titleFont || '',
      bodyFont: bodyFont || '',
    });
  }, [bodyFont, selectedPalette?.name, showWalkthrough, titleFont, walkthroughStep, walkthroughStyleBaseline]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchSites = async () => {
      try {
        setLoadingSites(true);
        const res = await fetch('/api/user/sites', { credentials: 'include' });
        if (res.ok) {
          const { sites } = await res.json();
          setUserSites(sites.map((s: any) => ({ ...s, isPublished: s.isPublished || false })));
        }
      } catch (error) {
        console.error('Failed to fetch user sites:', error);
      } finally {
        setLoadingSites(false);
      }
    };

    fetchSites();
  }, [isOpen, user]);

  const handleSave = () => {
    if (!user) {
      router.push('/signup');
      return;
    }
    onSave();
  };

  const executePublishRoute = async () => {
    // Launch-service interception: if the user is mid-launch-onboarding, send
    // them back to the payment step of the onboarding flow instead of through
    // the normal subscription/domain selection path.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const launchToken =
        params.get('launchToken') ||
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('ks_launch_token='))
          ?.split('=')[1];
      if (launchToken) {
        setIsPublishingUpdates(false);
        router.push(`/onboarding/launch/${launchToken}?step=payment`);
        return;
      }
    }

    try {
      setIsPublishingUpdates(true);
      // Check user subscription status
      const res = await fetch('/api/user/subscription', { credentials: 'include' });
      if (res.ok) {
        const { subscription } = await res.json();

        if (subscription && subscription.subscription_status === 'active') {
          // User already has an active subscription!
          if (isPublished && publishedDomain) {
            // Already published and paid - push updates directly
            const publishRes = await fetch('/api/sites/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                siteId: currentSiteId,
                publishedDomain: publishedDomain,
              }),
            });
            if (publishRes.ok) {
              onPublishSuccess?.();
              setAlertConfig({ isOpen: true, title: 'Site Updated', message: 'Your latest changes are now live!', type: 'success' });
              setTimeout(() => {
                router.refresh();
              }, 500);
            } else {
              const errorData = await publishRes.json().catch(() => null);
              if (errorData?.publishLimitReached) {
                setPublishLimitInfo({ plan: errorData.plan, limit: errorData.limit });
              } else {
                setAlertConfig({ isOpen: true, title: 'Publish Failed', message: 'There was an error updating your live site.', type: 'error' });
              }
            }
            setIsPublishingUpdates(false);
            return;
          } else {
            // Paid, but domain not set yet
            setIsPublishingUpdates(false);
            router.push(`/publish/domain-select?session_id=existing&siteId=${currentSiteId}`);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Failed to check subscription before publish:', err);
    }

    setIsPublishingUpdates(false);
    // No active subscription or error checking, proceed to pricing
    router.push('/pricing?action=publish&siteId=' + currentSiteId);
  };

  const handlePublish = async () => {
    // If there are unsaved changes, show modal to save first
    if (changes.length > 0) {
      setShowPublishModal(true);
      return;
    }

    await executePublishRoute();
  };

  const handlePublishAndSave = async () => {
    // Save first, then redirect to publishing path
    onSave();
    // Wait a moment for save to complete, then execute the publish route
    setTimeout(async () => {
      setShowPublishModal(false);
      await executePublishRoute();
    }, 500);
  };

  // Fetch site custom domain when delete confirm is shown
  const handleShowDeleteConfirm = async () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteSite = async () => {
    if (!currentSiteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId: currentSiteId }),
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
        router.push('/');
      } else {
        const data = await res.json();
        setAlertConfig({ isOpen: true, title: 'Delete Failed', message: data.error || 'Failed to delete site.', type: 'error' });
      }
    } catch {
      setAlertConfig({ isOpen: true, title: 'Delete Failed', message: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendTransfer = async () => {
    if (!currentSiteId || !transferEmail.trim()) return;
    setIsSendingTransfer(true);
    setTransferError(null);
    try {
      const res = await fetch('/api/sites/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId: currentSiteId,
          recipientEmail: transferEmail.trim(),
          includeDomain: transferIncludeDomain,
        }),
      });
      if (res.ok) {
        setTransferSent(true);
      } else {
        const data = await res.json();
        setTransferError(data.error || 'Failed to send transfer.');
      }
    } catch {
      setTransferError('An unexpected error occurred.');
    } finally {
      setIsSendingTransfer(false);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = drawerRef.current?.offsetHeight || 0;
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!isOpen || !drawerRef.current || !isDragging.current) return;
    const deltaY = e.clientY - dragStartY.current;

    // If dragged down significantly, close the drawer
    if (deltaY > 50) {
      onOpenChange(false);
      isDragging.current = false;
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  // ─── Shared panel content (used in both sidebar and drawer) ─────────

  const panelContent = (
    <div className="flex flex-col h-full max-h-full">

      {/* ── Site Info Header (non-scrollable) ── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-3" style={{ overflow: 'visible' }}>

        {/* Currently Editing + Rename + Site Switcher */}
        <div style={{ overflow: 'visible' }}>
          <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {isRenamingSite ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={siteTitleDraft}
                    onChange={(e) => setSiteTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onSiteTitle(siteTitleDraft); setIsRenamingSite(false); }
                      if (e.key === 'Escape') setIsRenamingSite(false);
                    }}
                    className="text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded px-2 py-0.5 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none w-full"
                    placeholder="Site name"
                  />
                  <button
                    onClick={() => { onSiteTitle(siteTitleDraft); setIsRenamingSite(false); }}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsRenamingSite(false)}
                    className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="font-bold text-sm text-slate-900 truncate">{siteTitle || 'Untitled Site'}</div>
                  <button
                    onClick={() => { setSiteTitleDraft(siteTitle); setIsRenamingSite(true); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    Rename
                  </button>
                  <div className="relative group flex-shrink-0">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                      This name is customer-facing. It appears as the sender name in booking confirmations, contact replies, membership emails, and more.
                      <div className="absolute right-1.5 -top-1 w-2 h-2 bg-slate-800 rotate-45" />
                    </div>
                  </div>
                </div>
              )}
              {templateName && !isRenamingSite && (
                <div className="text-[10px] text-slate-500 mt-0.5">{templateName}</div>
              )}
            </div>
            {user && !isRenamingSite && (
              <button
                onClick={() => setShowSiteSwitcher(!showSiteSwitcher)}
                className="ml-2 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                title="Switch or create sites"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSiteSwitcher ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Site Switcher Dropdown */}
          {user && showSiteSwitcher && (
            <div className="relative">
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in slide-in-from-top-2">
                <div className="max-h-60 overflow-y-auto outline-none p-2 space-y-1">
                  {userSites.length > 0 ? (
                    <>
                      <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Your Sites</div>
                      {userSites.map((site) => (
                        <div
                          key={site.id}
                          className={`w-full px-3 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2 group ${currentSiteId === site.id
                            ? 'bg-red-50 text-red-900 font-semibold border border-red-100'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                          <span className={`shrink-0 w-2 h-2 rounded-full ${site.isPublished ? 'bg-green-500' : 'bg-slate-300'}`} />
                          <button
                            onClick={() => {
                              setShowSiteSwitcher(false);
                              router.push(`/design?siteId=${site.id}`);
                            }}
                            className="truncate text-left flex-1"
                          >
                            {site.siteSlug || `Site ${site.id.slice(0, 8)}`}
                          </button>
                          {site.isPublished && currentSiteId !== site.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('This will take your site offline. Visitors will no longer be able to access it.')) return;
                                try {
                                  const res = await fetch('/api/sites/unpublish', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ siteId: site.id }),
                                  });
                                  if (res.ok) {
                                    setUserSites(prev => prev.map(s => s.id === site.id ? { ...s, isPublished: false } : s));
                                  }
                                } catch {}
                              }}
                              title="Unpublish site"
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 transition-all"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          )}
                          {currentSiteId === site.id && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                          )}
                        </div>
                      ))}
                      <div className="h-px bg-slate-100 my-2 mx-1" />
                    </>
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-500 text-center">No other sites found</div>
                  )}
                  <button
                    onClick={() => {
                      setShowSiteSwitcher(false);
                      router.push('/onboarding');
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 font-medium mt-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Site
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Accordions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Template Section */}
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm">
          <button
            onClick={() => toggleSection('template')}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-t-lg"
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" />
              Template
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('template') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('template') && (
            <div className="p-4 border-t border-slate-200 space-y-4">
              {/* Currently selected template */}
              <div>
                <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2">Current Template</h3>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  {templateThumbnailUrl ? (
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                      <img
                        src={templateThumbnailUrl}
                        alt={templateName || 'Template preview'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Layout className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {templateName || 'Untitled template'}
                    </p>
                    {templateDescription && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {templateDescription}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Change template — coming soon */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">Change Template</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                    Coming Soon
                  </span>
                </div>
                <div className="relative rounded-lg border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-3">
                  <div className="grid grid-cols-3 gap-2 opacity-50 pointer-events-none">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="aspect-[4/3] rounded-md bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center"
                      >
                        <Layout className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Browse and switch between templates without losing your content. Coming soon.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logos Section */}
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm" style={{ overflow: 'visible' }}>
          <button
            onClick={() => toggleSection('general')}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-t-lg"
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Logo
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('general') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('general') && (
            <div className="p-4 border-t border-slate-200 space-y-6" style={{ overflow: 'visible' }}>

              {/* Site Logo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">Site Logo</h3>
                  {/* Shared / Separate toggle */}
                  <button
                    onClick={() => onUpdateSiteContent('logoShared', siteContent.logoShared === false ? true : false)}
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border transition-all ${siteContent.logoShared === false
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                    title={siteContent.logoShared === false ? 'Using separate configs — click to share one logo' : 'Click to configure header, footer & favicon separately'}
                  >
                    {siteContent.logoShared === false ? 'Separate' : 'Shared'}
                  </button>
                </div>

                {siteContent.logoShared === false ? (
                  /* ── Separate configurations ── */
                  <div className="space-y-4">
                    {/* Header Logo */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Header</p>
                        <button
                          onClick={() => onUpdateSiteContent('showHeaderLogo', siteContent.showHeaderLogo === false ? true : false)}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${siteContent.showHeaderLogo === false ? 'border-slate-200 bg-white text-slate-400' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
                          title={siteContent.showHeaderLogo === false ? 'Logo hidden — click to show' : 'Logo visible — click to hide'}
                        >
                          {siteContent.showHeaderLogo === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {siteContent.showHeaderLogo === false ? 'Hidden' : 'Visible'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {(siteContent.headerLogo || logoUrl) ? (
                            <img src={siteContent.headerLogo || logoUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 text-center leading-tight">NO<br />LOGO</span>
                          )}
                        </div>
                        <button
                          onClick={() => setActiveLogoModal('header')}
                          className="flex-1 py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3 h-3" />
                          {siteContent.headerLogo ? 'Change' : 'Upload'}
                        </button>
                        {siteContent.headerLogo && (
                          <button
                            onClick={() => onUpdateSiteContent('headerLogo', '')}
                            className="py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-400 hover:text-red-600 text-[10px] rounded-lg transition-all"
                            title="Remove header logo (falls back to shared logo)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Monitor className="w-3 h-3" /> Height</label>
                          <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeight || 'Auto'}</span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="220"
                          step="4"
                          value={siteContent.headerLogoHeight || 40}
                          onChange={(e) => onUpdateSiteContent('headerLogoHeight', parseInt(e.target.value))}
                          className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <button
                        onClick={() => setHeaderLogoResponsiveOpen(o => !o)}
                        className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <span>Responsive sizes</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${headerLogoResponsiveOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {headerLogoResponsiveOpen && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Tablet className="w-3 h-3" /> Tablet</label>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeightMd || 'Default'}</span>
                                {siteContent.headerLogoHeightMd && (
                                  <button
                                    onClick={() => onUpdateSiteContent('headerLogoHeightMd', null)}
                                    className="text-[9px] text-slate-400 hover:text-red-600"
                                    title="Reset"
                                  >✕</button>
                                )}
                              </div>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="220"
                              step="4"
                              value={siteContent.headerLogoHeightMd || siteContent.headerLogoHeight || 40}
                              onChange={(e) => onUpdateSiteContent('headerLogoHeightMd', parseInt(e.target.value))}
                              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Phone</label>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeightSm || 'Default'}</span>
                                {siteContent.headerLogoHeightSm && (
                                  <button
                                    onClick={() => onUpdateSiteContent('headerLogoHeightSm', null)}
                                    className="text-[9px] text-slate-400 hover:text-red-600"
                                    title="Reset"
                                  >✕</button>
                                )}
                              </div>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="220"
                              step="4"
                              value={siteContent.headerLogoHeightSm || siteContent.headerLogoHeightMd || siteContent.headerLogoHeight || 40}
                              onChange={(e) => onUpdateSiteContent('headerLogoHeightSm', parseInt(e.target.value))}
                              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Logo */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Footer</p>
                        <button
                          onClick={() => onUpdateSiteContent('showFooterLogo', siteContent.showFooterLogo === false ? true : false)}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${siteContent.showFooterLogo === false ? 'border-slate-200 bg-white text-slate-400' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
                          title={siteContent.showFooterLogo === false ? 'Logo hidden — click to show' : 'Logo visible — click to hide'}
                        >
                          {siteContent.showFooterLogo === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {siteContent.showFooterLogo === false ? 'Hidden' : 'Visible'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {(siteContent.footerLogo || logoUrl) ? (
                            <img src={siteContent.footerLogo || logoUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 text-center leading-tight">NO<br />LOGO</span>
                          )}
                        </div>
                        <button
                          onClick={() => setActiveLogoModal('footer')}
                          className="flex-1 py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3 h-3" />
                          {siteContent.footerLogo ? 'Change' : 'Upload'}
                        </button>
                        {siteContent.footerLogo && (
                          <button
                            onClick={() => onUpdateSiteContent('footerLogo', '')}
                            className="py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-400 hover:text-red-600 text-[10px] rounded-lg transition-all"
                            title="Remove footer logo (falls back to shared logo)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-slate-500">Height</label>
                          <span className="text-[10px] text-slate-500 font-mono">{siteContent.footerLogoHeight || 'Auto'}</span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="220"
                          step="4"
                          value={siteContent.footerLogoHeight || 32}
                          onChange={(e) => onUpdateSiteContent('footerLogoHeight', parseInt(e.target.value))}
                          className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Favicon */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Favicon</p>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {(siteContent.faviconLogo || logoUrl) ? (
                            <img src={siteContent.faviconLogo || logoUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 text-center leading-tight">NO<br />LOGO</span>
                          )}
                        </div>
                        <button
                          onClick={() => setActiveLogoModal('favicon')}
                          className="flex-1 py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3 h-3" />
                          {siteContent.faviconLogo ? 'Change' : 'Upload'}
                        </button>
                        {siteContent.faviconLogo && (
                          <button
                            onClick={() => onUpdateSiteContent('faviconLogo', '')}
                            className="py-1.5 px-2 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-400 hover:text-red-600 text-[10px] rounded-lg transition-all"
                            title="Remove favicon (falls back to shared logo)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 italic">Shown as the browser tab icon.</p>
                    </div>
                  </div>
                ) : (
                  /* ── Shared configuration ── */
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Site Logo" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 text-center leading-tight">NO<br />LOGO</span>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveLogoModal('shared')}
                        className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {logoUrl ? 'Change Logo' : 'Upload Logo'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-400 italic mb-4">
                      Used in header, footer, and as favicon.
                    </p>

                    {/* Logo Height Controls */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Monitor className="w-3 h-3" /> Header Logo Height</label>
                            <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeight || 'Auto'}</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="220"
                            step="4"
                            value={siteContent.headerLogoHeight || 40}
                            onChange={(e) => onUpdateSiteContent('headerLogoHeight', parseInt(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <button
                          onClick={() => setHeaderLogoResponsiveOpen(o => !o)}
                          className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <span>Responsive sizes</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${headerLogoResponsiveOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {headerLogoResponsiveOpen && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Tablet className="w-3 h-3" /> Tablet</label>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeightMd || 'Default'}</span>
                                  {siteContent.headerLogoHeightMd && (
                                    <button
                                      onClick={() => onUpdateSiteContent('headerLogoHeightMd', null)}
                                      className="text-[9px] text-slate-400 hover:text-red-600"
                                      title="Reset"
                                    >✕</button>
                                  )}
                                </div>
                              </div>
                              <input
                                type="range"
                                min="20"
                                max="220"
                                step="4"
                                value={siteContent.headerLogoHeightMd || siteContent.headerLogoHeight || 40}
                                onChange={(e) => onUpdateSiteContent('headerLogoHeightMd', parseInt(e.target.value))}
                                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Phone</label>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 font-mono">{siteContent.headerLogoHeightSm || 'Default'}</span>
                                  {siteContent.headerLogoHeightSm && (
                                    <button
                                      onClick={() => onUpdateSiteContent('headerLogoHeightSm', null)}
                                      className="text-[9px] text-slate-400 hover:text-red-600"
                                      title="Reset"
                                    >✕</button>
                                  )}
                                </div>
                              </div>
                              <input
                                type="range"
                                min="20"
                                max="220"
                                step="4"
                                value={siteContent.headerLogoHeightSm || siteContent.headerLogoHeightMd || siteContent.headerLogoHeight || 40}
                                onChange={(e) => onUpdateSiteContent('headerLogoHeightSm', parseInt(e.target.value))}
                                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-slate-500">Footer Logo Height</label>
                          <span className="text-[10px] text-slate-500 font-mono">{siteContent.footerLogoHeight || 'Auto'}</span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="220"
                          step="4"
                          value={siteContent.footerLogoHeight || 32}
                          onChange={(e) => onUpdateSiteContent('footerLogoHeight', parseInt(e.target.value))}
                          className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Visibility Toggles */}
                    <div className="pt-1 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Visibility</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onUpdateSiteContent('showHeaderLogo', siteContent.showHeaderLogo === false ? true : false)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-[10px] font-bold transition-all ${siteContent.showHeaderLogo === false ? 'border-slate-200 bg-white text-slate-400' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
                          title={siteContent.showHeaderLogo === false ? 'Logo hidden in header — click to show' : 'Logo visible in header — click to hide'}
                        >
                          {siteContent.showHeaderLogo === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          Header
                        </button>
                        <button
                          onClick={() => onUpdateSiteContent('showFooterLogo', siteContent.showFooterLogo === false ? true : false)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-[10px] font-bold transition-all ${siteContent.showFooterLogo === false ? 'border-slate-200 bg-white text-slate-400' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
                          title={siteContent.showFooterLogo === false ? 'Logo hidden in footer — click to show' : 'Logo visible in footer — click to hide'}
                        >
                          {siteContent.showFooterLogo === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          Footer
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Layout Section */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleSection('layout')}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" />
              Layout
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('layout') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('layout') && (
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">Container Width</h3>
                <span className="text-[10px] font-mono font-semibold text-slate-500">
                  {SITE_LAYOUT_CONTAINER_WIDTH_OPTIONS.find((option) => option.value === selectedContainerWidth)?.maxWidthPx}px
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SITE_LAYOUT_CONTAINER_WIDTH_OPTIONS.map((option) => {
                  const active = selectedContainerWidth === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdateSiteContent(SITE_LAYOUT_CONTAINER_WIDTH_KEY, option.value)}
                      aria-pressed={active}
                      className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <ContainerWidthPreview value={option.value} active={active} />
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{option.label}</span>
                        <span className="text-[10px] font-mono font-semibold opacity-70">{option.maxWidthPx}px</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedContainerWidth !== DEFAULT_SITE_LAYOUT_CONTAINER_WIDTH && (
                <button
                  type="button"
                  onClick={() => onUpdateSiteContent(SITE_LAYOUT_CONTAINER_WIDTH_KEY, DEFAULT_SITE_LAYOUT_CONTAINER_WIDTH)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Reset to default
                </button>
              )}
            </div>
          )}
        </div>

        <div data-tour="builder-design-panel" className="space-y-3">
        {/* Colors Section */}
        {templatePalettes && templatePalettes.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => toggleSection('colors')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5" />
                Colors
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('colors') ? 'rotate-180' : ''}`} />
            </button>

            {openSections.includes('colors') && (
              <div className="p-4 border-t border-slate-200">
                <div className="grid grid-cols-4 gap-3">
                  {templatePalettes.map((palette) => (
                    <button
                      key={palette.name}
                      onClick={() => onSelectPalette?.(palette)}
                      className="group relative flex flex-col items-center transition-all"
                      title={palette.name}
                    >
                      <div className={`w-full h-10 flex rounded-lg overflow-hidden border-2 transition-all ${selectedPalette?.name === palette.name
                        ? 'shadow-lg border-red-500'
                        : 'border-slate-200 hover:border-slate-400'
                        }`}
                        style={selectedPalette?.name === palette.name ? { borderColor: 'var(--brand-primary)' } : {}}
                      >
                        <div className="flex-1" style={{ backgroundColor: palette.primary }} />
                        <div className="flex-1" style={{ backgroundColor: palette.secondary }} />
                        <div className="flex-1" style={{ backgroundColor: palette.accent }} />
                        {selectedPalette?.name === palette.name && (
                          <div className="absolute top-1 right-1 text-white rounded-full p-0.5" style={{ backgroundColor: 'var(--brand-primary)' }}>
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          </div>
                        )}
                      </div>
                      <span className={`capitalize text-[10px] font-semibold mt-1 transition-colors ${selectedPalette?.name === palette.name ? 'text-red-600' : 'text-slate-500'}`}>{palette.name}</span>
                    </button>
                  ))}
                </div>

                {selectedPalette?.name === 'custom' && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Primary</span>
                      <CustomPaletteColorInput type="primary" value={selectedPalette.primary} onCustomColorChange={onCustomColorChange} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Secondary</span>
                      <CustomPaletteColorInput type="secondary" value={selectedPalette.secondary} onCustomColorChange={onCustomColorChange} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Accent</span>
                      <CustomPaletteColorInput type="accent" value={selectedPalette.accent} onCustomColorChange={onCustomColorChange} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Typography Section */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleSection('typography')}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" />
              Typography
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('typography') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('typography') && (
            <div className="p-4 border-t border-slate-200 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2 block">Heading Font</label>
                <button
                  onClick={() => setFontPickerState({ isOpen: true, type: 'title' })}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all font-sans"
                >
                  <span className="text-sm font-semibold text-slate-800" style={titleFont ? { fontFamily: `"${titleFont}", sans-serif` } : {}}>{titleFont || 'Default Serif'}</span>
                  <Type className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2 block">Body Text Font</label>
                <button
                  onClick={() => setFontPickerState({ isOpen: true, type: 'body' })}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all font-sans"
                >
                  <span className="text-sm font-medium text-slate-800" style={bodyFont ? { fontFamily: `"${bodyFont}", sans-serif` } : {}}>{bodyFont || 'Default Sans'}</span>
                  <Type className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Animation Section */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleSection('animation')}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Animation
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('animation') ? 'rotate-180' : ''}`} />
          </button>
          {openSections.includes('animation') && (
            <div className="p-4 border-t border-slate-200 space-y-3">
              <p className="text-[11px] leading-snug text-slate-500">Default scroll-in animation for sections. Individual blocks can override this in their settings.</p>
              <SiteAnimationControls
                siteContent={siteContent}
                onUpdateSiteContent={(key, value) => onUpdateSiteContent(key, value)}
              />
            </div>
          )}
        </div>
        </div>

        {/* AI Builder Section */}
        <div ref={aiBuilderSectionRef} data-tour="builder-ai-builder" className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3 transition-colors hover:from-violet-100 hover:to-purple-100">
            <button
              type="button"
              onClick={() => toggleSection('ai-builder')}
              className="flex min-w-0 flex-1 items-center justify-between"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-700">
                <img src="/assets/archie.png" alt="" className="w-4 h-auto" aria-hidden="true" />
                AI Builder
                {!isProUser && !isBasicUser && !isFreeUser && <span className="ml-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">PRO</span>}
                {isFreeUser && freeAiPromptsLeft !== 0 && (
                  <span className="ml-1 rounded-full bg-slate-400 px-1.5 py-0.5 text-[9px] font-bold text-white normal-case">
                    {freeAiBadgeLabel}
                  </span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-violet-500 transition-transform ${openSections.includes('ai-builder') ? 'rotate-180' : ''}`} />
            </button>
            {isFreeUser && freeAiPromptsLeft === 0 && (
              <Link
                href="/pricing"
                className="shrink-0 rounded-full bg-violet-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-violet-700"
              >
                0 left / Upgrade Plan
              </Link>
            )}
          </div>

          {openSections.includes('ai-builder') && (
            <div className="border-t border-slate-200">
              <AIBuilderPanel
                messages={aiMessages}
                isLoading={aiIsLoading}
                progressMessage={aiProgressMessage}
                onSend={onAiSend || (() => { })}
                onCancel={onAiCancel || (() => { })}
                onClear={onAiClear || (() => { })}
                onUndo={onUndo}
                canUndo={canUndo}
                isPro={isProUser}
                isBasic={isBasicUser}
                isFree={isFreeUser}
                remaining={aiRemaining}
                showUpgradeModal={showAiUpgradeModal}
                onDismissUpgradeModal={onDismissAiUpgradeModal || (() => { })}
              />
            </div>
          )}
        </div>

        {/* Translations Section */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleSection('translations')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
          >
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" />
              Translations
            </span>
            <ChevronDown className={`w-4 h-4 text-blue-500 transition-transform ${openSections.includes('translations') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('translations') && (
            <div className="border-t border-slate-200">
              <TranslationsPanel siteId={currentSiteId} />
            </div>
          )}
        </div>

        {/* Health Check Section */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleSection('doctor')}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-50 to-orange-50 hover:from-rose-100 hover:to-orange-100 transition-colors"
          >
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              Health Check
            </span>
            <ChevronDown className={`w-4 h-4 text-rose-500 transition-transform ${openSections.includes('doctor') ? 'rotate-180' : ''}`} />
          </button>

          {openSections.includes('doctor') && (
            <div className="border-t border-slate-200">
              <DoctorPanel siteId={currentSiteId} />
            </div>
          )}
        </div>

        {/* Other Settings Section */}
        {user && currentSiteId && (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => toggleSection('other-settings')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Other Settings
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openSections.includes('other-settings') ? 'rotate-180' : ''}`} />
            </button>

            {openSections.includes('other-settings') && (
              <div className="p-4 border-t border-slate-200 space-y-4">
                {/* Edit History */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2">Edit History</h3>
                  <p className="text-xs text-slate-500 mb-3">View past saves and published versions. Revert to any previous state.</p>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    View History
                  </button>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200" />

                {/* Transfer Site */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2">Transfer Site</h3>
                  <p className="text-xs text-slate-500 mb-3">Send this site to someone else. They'll receive an email with a link to claim it. The link expires in 7 days.</p>

                  {transferSent ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center space-y-2">
                      <p className="text-xs text-green-800 font-semibold">Transfer email sent!</p>
                      <p className="text-[10px] text-green-700">An email has been sent to <strong>{transferEmail}</strong>. They'll have 7 days to claim it.</p>
                      <button
                        onClick={() => { setTransferSent(false); setTransferEmail(''); setTransferIncludeDomain(false); setTransferError(null); }}
                        className="text-[10px] text-green-700 underline hover:no-underline"
                      >
                        Send to someone else
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={transferEmail}
                        onChange={(e) => setTransferEmail(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 placeholder-slate-400"
                      />
                      {customDomain && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={transferIncludeDomain}
                            onChange={(e) => setTransferIncludeDomain(e.target.checked)}
                            className="w-3.5 h-3.5 accent-blue-600"
                          />
                          <span className="text-[11px] text-slate-600">
                            Include domain <span className="font-mono text-slate-700">{customDomain}</span>
                          </span>
                        </label>
                      )}
                      {transferError && (
                        <p className="text-[10px] text-red-600">{transferError}</p>
                      )}
                      <button
                        onClick={handleSendTransfer}
                        disabled={isSendingTransfer || !transferEmail.trim()}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {isSendingTransfer ? 'Sending...' : 'Send Transfer Email'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-200" />

                {/* Delete Site */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-red-500 tracking-wide mb-2">Danger Zone</h3>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={handleShowDeleteConfirm}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Site
                    </button>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-3">
                      <p className="text-xs text-red-700 font-medium">
                        This action cannot be undone. This will permanently delete your site, all its pages, and all associated data.
                      </p>

                      {/* Domain ownership notice */}
                      {customDomain && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-xs text-blue-800 font-medium">
                            Your domain <strong className="font-mono">{customDomain}</strong> is still yours.
                          </p>
                          <p className="text-[10px] text-blue-600 mt-0.5">
                            It will remain in your account until your current billing cycle ends. You can reassign it to another site from your Account Settings.
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-red-600">
                        Type <strong>{siteTitle || 'delete'}</strong> to confirm:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full text-sm text-slate-900 bg-white border border-red-300 rounded-lg px-3 py-2 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none placeholder-slate-400"
                        placeholder={siteTitle || 'delete'}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteSite}
                          disabled={isDeleting || deleteConfirmText !== (siteTitle || 'delete')}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete Forever'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Section (Actions) */}
      <div data-tour="builder-save-actions" className="shrink-0 p-4 bg-slate-50 border-t border-slate-200 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">

        {/* Unsaved Changes Section */}
        {changes && (changes.length > 0 || canRedo) && (
          <div>
            <button
              onClick={() => setShowChanges(!showChanges)}
              className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg transition-colors ${changes.length > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${changes.length > 0 ? 'bg-amber-400' : 'bg-slate-400'}`}>
                  {changes.length}
                </div>
                <span className={`text-xs font-semibold ${changes.length > 0 ? 'text-amber-900' : 'text-slate-700'}`}>
                  {changes.length > 0
                    ? `${changes.length} unsaved change${changes.length !== 1 ? 's' : ''}`
                    : 'No unsaved changes'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${changes.length > 0 ? 'text-amber-700' : 'text-slate-500'} ${showChanges ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex gap-2 mt-2">
              <button onClick={onUndo} disabled={!canUndo} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold text-xs rounded transition-colors">
                <RotateCcw className="w-3 h-3" />
                Undo
              </button>
              <button onClick={onRedo} disabled={!canRedo} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold text-xs rounded transition-colors">
                <RotateCw className="w-3 h-3" />
                Redo
              </button>
            </div>

            {showChanges && (
              <div className="mt-2 p-3 space-y-2 max-h-28 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-inner">
                {changes.length > 0 ? changes.map((change) => (
                  <div key={change.id} className="text-[10px] text-slate-700 pb-2 border-b border-slate-100 last:border-b-0">
                    <div className="font-bold text-slate-900 mb-0.5">{change.label}</div>
                    <div className="text-slate-600 flex flex-col gap-0.5">
                      <span className="line-through text-red-500 break-all">{change.from || '(empty)'}</span>
                      <span className="text-green-600 break-all">{change.to || '(empty)'}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-[10px] font-semibold text-slate-500">No unsaved changes</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save Draft & Publish / Live Site Actions */}
        <div className="flex flex-col gap-2">
          {isPublished && publishedDomain ? (
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFullyDeployed ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isFullyDeployed ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isFullyDeployed ? 'text-slate-700' : 'text-amber-700'}`}>
                    {isFullyDeployed ? 'Live' : 'Unpublished'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {customDomain ? (
                    <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-500 hover:text-slate-900 border-b border-slate-300 transition-colors truncate max-w-[120px]">{customDomain}</a>
                  ) : (
                    <a href={`https://${publishedDomain}.kswd.ca`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-500 hover:text-slate-900 border-b border-slate-300 transition-colors truncate max-w-[120px]">{publishedDomain}.kswd.ca</a>
                  )}
                  {pendingCustomDomain && (
                    <span className="text-[9px] text-amber-600 font-medium" title={`${pendingCustomDomain} — pending verification`}>⏳</span>
                  )}
                  <button onClick={() => router.push(`/publish/domain-select?session_id=existing&siteId=${currentSiteId}`)} className="p-1 hover:bg-slate-100 rounded text-slate-400" title="Domain settings"><Pencil className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving || changes.length === 0} className="flex-[0.8] py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded transition-colors">Save</button>
                {!isFullyDeployed ? (
                  <button onClick={handlePublish} disabled={publishing || isPublishingUpdates} className="flex-[1.2] py-1.5 text-white font-semibold text-xs rounded transition-colors hover:brightness-110" style={{ backgroundColor: 'var(--brand-primary)' }}>{(publishing || isPublishingUpdates) ? 'Publishing...' : 'Publish'}</button>
                ) : (
                  <a href={customDomain ? `https://${customDomain}` : `https://${publishedDomain}.kswd.ca`} target="_blank" rel="noopener noreferrer" className="flex-[1.2] flex items-center justify-center py-1.5 text-white font-semibold text-xs rounded transition-colors hover:brightness-110" style={{ backgroundColor: 'var(--brand-primary)' }}>View Live</a>
                )}
                <button
                  onClick={() => setShowPreviewModal(true)}
                  disabled={!currentSiteId}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded transition-colors"
                  title="Share draft preview"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || changes.length === 0} className="flex-1 py-2 text-white font-bold text-sm rounded-lg hover:brightness-110 disabled:opacity-60 bg-slate-600">{saving ? 'Saving...' : user ? 'Save Draft' : 'Sign Up to Save'}</button>
              <button onClick={handlePublish} disabled={publishing || !user || isSynced} className="flex-1 py-2 text-white font-bold text-sm rounded-lg hover:brightness-110 disabled:opacity-60" style={{ backgroundColor: isSynced ? '#94a3b8' : 'var(--brand-primary)' }}>{publishing ? 'Publishing...' : isSynced ? 'Published' : 'Publish'}</button>
              <button
                onClick={() => setShowPreviewModal(true)}
                disabled={!currentSiteId}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                title="Share draft preview"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>

      <FontPickerModal
        isOpen={fontPickerState.isOpen}
        onClose={() => setFontPickerState(prev => ({ ...prev, isOpen: false }))}
        title={fontPickerState.type === 'title' ? 'Select Heading Font' : 'Select Body Font'}
        currentFont={fontPickerState.type === 'title' ? titleFont : bodyFont}
        previewText={fontPickerState.type === 'title' ? (siteTitle || 'The quick brown fox') : 'The quick brown fox jumps over the lazy dog'}
        onSelect={(fontName) => {
          if (fontPickerState.type === 'title') {
            onTitleFontChange?.(fontName);
          } else {
            onBodyFontChange?.(fontName);
          }
        }}
      />
    </div>
  );


  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          LARGE SCREEN: Left Sidebar
         ═══════════════════════════════════════════════════════════════ */}
      {isLargeScreen && (
        <>
          {/* Sidebar Panel */}
          <div
            ref={drawerRef}
            className={`fixed top-[var(--impersonation-height,0px)] left-0 bottom-0 z-[9999] bg-white shadow-2xl border-r border-slate-200 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ width: '22rem' }}
          >
            {/* Sidebar Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-3 h-12 flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                <div
                  onClick={(e) => {
                    if (changes.length > 0) {
                      e.preventDefault();
                      setAlertConfig({
                        isOpen: true,
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                        type: 'warning',
                        onConfirm: () => router.push('/'),
                        confirmLabel: 'Leave',
                        cancelLabel: 'Stay'
                      });
                    } else {
                      router.push('/');
                    }
                  }}
                  className="cursor-pointer shrink-0"
                >
                  <KeystoneLogo href={undefined} size="md" showText={false} />
                </div>

                {/* Design / Admin switcher */}
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white shadow-sm text-slate-800 select-none">
                    <Paintbrush className="w-3 h-3" />
                    Design
                  </span>
                  <a
                    href={`/admin/analytics${currentSiteId ? `?siteId=${currentSiteId}` : ''}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                      e.preventDefault();
                      const dest = `/admin/analytics${currentSiteId ? `?siteId=${currentSiteId}` : ''}`;
                      if (changes.length > 0) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Unsaved Changes',
                          message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                          type: 'warning',
                          onConfirm: () => router.push(dest),
                          confirmLabel: 'Leave',
                          cancelLabel: 'Stay',
                        });
                      } else {
                        router.push(dest);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors"
                  >
                    <LayoutDashboard className="w-3 h-3" />
                    Admin
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openWalkthrough}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Show walkthrough"
                  aria-label="Show walkthrough"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <ProfileDropdown
                  buttonClassName="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors flex-shrink-0 overflow-hidden"
                  onSettingsClick={(e) => {
                  if (changes.length > 0) {
                    e.preventDefault();
                    setAlertConfig({
                      isOpen: true,
                      title: 'Unsaved Changes',
                      message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                      type: 'warning',
                      onConfirm: () => router.push('/settings'),
                      confirmLabel: 'Leave',
                      cancelLabel: 'Stay'
                    });
                  }
                }} />
              </div>
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 min-h-0">
              {panelContent}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SMALL SCREEN: Bottom Drawer (original behavior)
         ═══════════════════════════════════════════════════════════════ */}
      {!isLargeScreen && (
        <>
          {/* Drawer Overlay */}
          {isOpen && (
            <div
              className="fixed inset-0 bg-black/5 z-[9998] overscroll-none touch-none"
              onClick={() => onOpenChange(false)}
            />
          )}

          {/* Drawer */}
          {isOpen && (
            <div
              ref={drawerRef}
              className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto overscroll-contain transition-all duration-300 ease-out animate-in slide-in-from-bottom-10"
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >
              {/* White Header with Logo - Draggable */}
              <div
                className="z-[100] sticky top-0 bg-white border-b border-slate-200 px-3 py-3 flex items-center justify-between rounded-t-3xl cursor-grab active:cursor-grabbing group"
                onMouseDown={handleDragStart}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="cursor-pointer shrink-0"
                    onClick={() => {
                      if (changes.length > 0) {
                        setAlertConfig({
                          isOpen: true,
                          title: 'Unsaved Changes',
                          message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                          type: 'warning',
                          onConfirm: () => router.push('/'),
                          confirmLabel: 'Leave',
                          cancelLabel: 'Stay'
                        });
                      } else {
                        router.push('/');
                      }
                    }}
                  >
                    <KeystoneLogo href={undefined} size="sm" showText={false} />
                  </div>

                  {/* Design / Admin switcher */}
                  <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white shadow-sm text-slate-800 select-none">
                      <Paintbrush className="w-3 h-3" />
                      Design
                    </span>
                    <a
                      href={`/admin/analytics${currentSiteId ? `?siteId=${currentSiteId}` : ''}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                        e.preventDefault();
                        const dest = `/admin/analytics${currentSiteId ? `?siteId=${currentSiteId}` : ''}`;
                        if (changes.length > 0) {
                          setAlertConfig({
                            isOpen: true,
                            title: 'Unsaved Changes',
                            message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                            type: 'warning',
                            onConfirm: () => router.push(dest),
                            confirmLabel: 'Leave',
                            cancelLabel: 'Stay',
                          });
                        } else {
                          router.push(dest);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors"
                    >
                      <LayoutDashboard className="w-3 h-3" />
                      Admin
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openWalkthrough}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Show walkthrough"
                    aria-label="Show walkthrough"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  <ProfileDropdown onSettingsClick={(e) => {
                    if (changes.length > 0) {
                      e.preventDefault();
                      setAlertConfig({
                        isOpen: true,
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes that will be lost if you leave. Are you sure?',
                        type: 'warning',
                        onConfirm: () => router.push('/settings'),
                        confirmLabel: 'Leave',
                        cancelLabel: 'Stay'
                      });
                    }
                  }} />
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-900"
                    title="Close (drag down to close)"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              {panelContent}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALS (shared, always rendered)
         ═══════════════════════════════════════════════════════════════ */}

      {/* Preview Modal */}
      {showPreviewModal && currentSiteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-slate-900">Share Draft Preview</h2>
              <button onClick={() => setShowPreviewModal(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Share this link so stakeholders can view your site draft before you publish. No account required to view.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
              <span className="text-xs text-slate-600 truncate flex-1 font-mono select-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/preview?siteId=${currentSiteId}` : `/preview?siteId=${currentSiteId}`}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/preview?siteId=${currentSiteId}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setPreviewLinkCopied(true);
                    setTimeout(() => setPreviewLinkCopied(false), 2000);
                  });
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors"
              >
                {previewLinkCopied ? <CheckIcon className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
                {previewLinkCopied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={`/preview?siteId=${currentSiteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2 text-white font-semibold text-sm rounded-lg transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Eye className="w-4 h-4" />
                Open Preview
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal - Show when user tries to publish with unsaved changes */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Publish Your Site?</h2>

            <p className="text-slate-600 mb-6">
              You have <strong>{changes.length} unsaved change{changes.length !== 1 ? 's' : ''}</strong> that need to be saved before publishing.
            </p>

            {/* Show changes summary */}
            {changes.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-700 mb-2">Unsaved changes:</p>
                <div className="space-y-2">
                  {changes.map((change) => (
                    <div key={change.id} className="text-xs text-slate-600 pb-2 border-b border-slate-100 last:border-b-0">
                      <div className="font-semibold text-slate-800 mb-0.5">{change.label}</div>
                      <div className="flex flex-col gap-0.5">
                        <span className="line-through text-red-400 break-all">{change.from || '(empty)'}</span>
                        <span className="text-green-600 break-all">{change.to || '(empty)'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishAndSave}
                disabled={saving}
                className="flex-1 py-2 px-4 text-white font-bold rounded-lg transition-colors hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        onConfirm={alertConfig.onConfirm}
        confirmLabel={alertConfig.confirmLabel}
        cancelLabel={alertConfig.cancelLabel}
      />

      {publishLimitInfo && (
        <SiteLimitModal
          plan={publishLimitInfo.plan}
          limit={publishLimitInfo.limit}
          onDismiss={() => setPublishLimitInfo(null)}
          onManageSites={() => {
            setPublishLimitInfo(null);
            router.push('/admin');
          }}
        />
      )}

      {currentSiteId && (
        <EditHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          siteId={currentSiteId}
          onRevert={onHistoryRevert || (() => { })}
        />
      )}

      {/* Shared logo modal */}
      <ImageEditorModal
        isOpen={activeLogoModal === 'shared'}
        onClose={() => setActiveLogoModal(null)}
        currentImageUrl={logoUrl}
        siteCategory={siteCategory}
        siteId={currentSiteId || ''}
        onSave={(url) => {
          onLogoChange?.(url);
          setActiveLogoModal(null);
        }}
        onUpload={uploadImage || (async () => '')}
        contentKey="siteLogo"
        allowUnsplash={false}
      />
      {/* Header logo modal */}
      <ImageEditorModal
        isOpen={activeLogoModal === 'header'}
        onClose={() => setActiveLogoModal(null)}
        currentImageUrl={siteContent.headerLogo || logoUrl}
        siteCategory={siteCategory}
        siteId={currentSiteId || ''}
        onSave={(url) => {
          onUpdateSiteContent('headerLogo', url);
          setActiveLogoModal(null);
        }}
        onUpload={uploadImage || (async () => '')}
        contentKey="headerLogo"
        allowUnsplash={false}
      />
      {/* Footer logo modal */}
      <ImageEditorModal
        isOpen={activeLogoModal === 'footer'}
        onClose={() => setActiveLogoModal(null)}
        currentImageUrl={siteContent.footerLogo || logoUrl}
        siteCategory={siteCategory}
        siteId={currentSiteId || ''}
        onSave={(url) => {
          onUpdateSiteContent('footerLogo', url);
          setActiveLogoModal(null);
        }}
        onUpload={uploadImage || (async () => '')}
        contentKey="footerLogo"
        allowUnsplash={false}
      />
      {/* Favicon logo modal */}
      <ImageEditorModal
        isOpen={activeLogoModal === 'favicon'}
        onClose={() => setActiveLogoModal(null)}
        currentImageUrl={siteContent.faviconLogo || logoUrl}
        siteCategory={siteCategory}
        siteId={currentSiteId || ''}
        onSave={(url) => {
          onUpdateSiteContent('faviconLogo', url);
          setActiveLogoModal(null);
        }}
        onUpload={uploadImage || (async () => '')}
        contentKey="faviconLogo"
        allowUnsplash={false}
      />

      <div className="pointer-events-none fixed bottom-5 right-5 z-[9997]">
        <div className="group pointer-events-auto relative">
          <button
            type="button"
            data-tour="builder-help-button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition-colors hover:bg-slate-700"
            aria-label="Open help options"
            aria-haspopup="menu"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute bottom-12 right-0 w-56 translate-y-1 pb-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={openWalkthrough}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:bg-slate-100 focus:outline-none"
              >
                <HelpCircle className="h-4 w-4 text-slate-500" />
                Restart tutorial
              </button>
              <a
                href="/builder-blocks"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700 focus:outline-none"
              >
                <BookOpen className="h-4 w-4 text-red-500" />
                Block docs
              </a>
            </div>
          </div>
        </div>
      </div>

      <WalkthroughModal
        isOpen={showWalkthrough}
        onClose={handleCloseWalkthrough}
        onRestore={closeWalkthroughTransientUi}
        steps={designerSteps}
        currentStep={walkthroughStep}
        onNext={handleNextWalkthrough}
        onPrev={handlePrevWalkthrough}
        title="Design Studio Guide"
        isNextDisabled={
          (walkthroughStep === 1 && !isEditMode) ||
          (walkthroughStep === 4 && currentPageSlug === 'home') ||
          (walkthroughStep === 5 && currentPageSlug !== 'home') ||
          (walkthroughStep === COLORS_FONTS_CONTROLS_STEP_INDEX && !hasChangedColorsOrFonts)
        }
        nextButtonLabel={walkthroughStep === 0 ? 'Start Tour' : undefined}
      />
    </>
  );
}

function ContainerWidthPreview({
  value,
  active,
}: {
  value: SiteLayoutContainerWidth;
  active: boolean;
}) {
  const widthByOption: Record<SiteLayoutContainerWidth, string> = {
    small: '58%',
    medium: '68%',
    large: '78%',
    wide: '90%',
  };

  return (
    <span className={`block rounded-lg border px-2 py-2 ${active ? 'border-blue-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
      <span className="block h-1.5 rounded-full bg-slate-200" />
      <span
        className={`mx-auto mt-2 block h-5 rounded-md ${active ? 'bg-blue-500' : 'bg-slate-400'}`}
        style={{ width: widthByOption[value] }}
      />
      <span className="mt-2 grid grid-cols-3 gap-1">
        <span className="h-1 rounded-full bg-slate-200" />
        <span className="h-1 rounded-full bg-slate-200" />
        <span className="h-1 rounded-full bg-slate-200" />
      </span>
    </span>
  );
}

function CustomPaletteColorInput({
  type,
  value,
  onCustomColorChange,
}: {
  type: PaletteColorType;
  value: string;
  onCustomColorChange?: FloatingToolbarProps['onCustomColorChange'];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeChange = () => {
      onCustomColorChange?.(type, input.value, { commit: true });
    };

    input.addEventListener('change', handleNativeChange);
    return () => input.removeEventListener('change', handleNativeChange);
  }, [onCustomColorChange, type]);

  return (
    <input
      ref={inputRef}
      type="color"
      value={value}
      onInput={(e) => onCustomColorChange?.(type, e.currentTarget.value)}
      onBlur={(e) => onCustomColorChange?.(type, e.currentTarget.value, { commit: true })}
      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
    />
  );
}
