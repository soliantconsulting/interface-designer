import { Box, Chip, Stack, Button, IconButton, Divider } from '@mui/material';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, List as ChevronList, X } from 'lucide-react';
import { AI_OPPORTUNITIES } from './aiOpportunities';
import { useAITour } from './AIProvider';

const CARD_W = 430;
const GAP = 18;
const PAD = 8;

interface Rect { top: number; left: number; width: number; height: number }

function useTargetRect(selector: string | null, active: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const raf = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!active || !selector) { setRect(null); return; }

    let cancelled = false;
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      // If the target is off-screen, bring it into view once, then re-measure.
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        requestAnimationFrame(() => {
          if (cancelled) return;
          const r2 = el.getBoundingClientRect();
          setRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
        });
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Give the route a frame to render before measuring.
    raf.current = requestAnimationFrame(() => {
      measure();
      // Layouts settle late (fonts, images); measure once more shortly after.
      setTimeout(measure, 90);
    });

    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [selector, active]);

  return rect;
}

function cardPosition(rect: Rect | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (t: number) => Math.max(GAP, Math.min(vh - cardH - GAP, t));
  const clampLeft = (l: number) => Math.max(GAP, Math.min(vw - CARD_W - GAP, l));

  if (!rect) return { top: clampTop(vh / 2 - cardH / 2), left: clampLeft(vw - CARD_W - GAP) };

  const rightSpace = vw - (rect.left + rect.width);
  const leftSpace = rect.left;
  const belowSpace = vh - (rect.top + rect.height);

  if (rightSpace > CARD_W + GAP * 2) {
    return { top: clampTop(rect.top - PAD), left: clampLeft(rect.left + rect.width + GAP) };
  }
  if (leftSpace > CARD_W + GAP * 2) {
    return { top: clampTop(rect.top - PAD), left: clampLeft(rect.left - CARD_W - GAP) };
  }
  if (belowSpace > cardH + GAP * 2) {
    return { top: clampTop(rect.top + rect.height + GAP), left: clampLeft(rect.left) };
  }
  return { top: clampTop(rect.top - cardH - GAP), left: clampLeft(rect.left) };
}

const PHASE_COLOR: Record<string, string> = {
  'Quick Win': '#1B8A4B',
  'Phase 2': '#0972D3',
  Horizon: '#7D4CDB',
};

export function AIOverlay({ navigate }: { navigate?: (to: string) => void }) {
  const {
    isOpen, opportunity, highlight, index, highlightIndex,
    total, totalHighlights, ordinal, isFirst, isLast,
    next, prev, close, goTo,
  } = useAITour();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cardH, setCardH] = useState(340);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Navigate to the opportunity's route before we try to spotlight anything on it.
  useEffect(() => {
    if (!isOpen || !opportunity || !navigate) return;
    if (window.location.pathname !== opportunity.route) navigate(opportunity.route);
  }, [isOpen, opportunity, navigate]);

  const rect = useTargetRect(isOpen ? highlight?.target ?? null : null, isOpen);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [opportunity, highlightIndex, isOpen]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') prev();
    },
    [isOpen, close, next, prev],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (!isOpen || !opportunity) return null;

  const pos = cardPosition(rect, cardH);
  const phaseColor = PHASE_COLOR[opportunity.phase] ?? '#0972D3';

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      {/* Spotlight. A single element with an enormous shadow dims everything else,
          which keeps the cut-out pixel-accurate at any size. */}
      {rect ? (
        <Box
          sx={{
            position: 'fixed',
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: '4px',
            boxShadow: '0 0 0 9999px rgba(12,18,28,0.62)',
            border: '2px solid #FF9900',
            transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(12,18,28,0.62)' }} />
      )}

      {/* Click-off layer, behind the card. */}
      <Box sx={{ position: 'fixed', inset: 0 }} onClick={close} />

      <Box
        ref={cardRef}
        sx={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: CARD_W,
          bgcolor: '#FFFFFF',
          borderRadius: '10px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          transition: 'top 180ms ease, left 180ms ease',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        }}
      >
        <Box sx={{ bgcolor: '#232F3E', px: 2.25, py: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: '#FF9900' }}>
                {opportunity.ref}
              </Box>
              <Chip
                label={opportunity.phase}
                size="small"
                sx={{
                  height: 18, fontSize: 10, fontWeight: 700, color: '#fff',
                  bgcolor: phaseColor, '& .MuiChip-label': { px: 1 },
                }}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                {ordinal} / {totalHighlights}
              </Box>
              <IconButton size="small" onClick={() => setMenuOpen((v) => !v)} sx={{ color: 'rgba(255,255,255,0.75)' }}>
                <ChevronList size={15} />
              </IconButton>
              <IconButton size="small" onClick={close} sx={{ color: 'rgba(255,255,255,0.75)' }}>
                <X size={15} />
              </IconButton>
            </Stack>
          </Stack>
          <Box sx={{ mt: 0.75, fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
            {opportunity.title}
          </Box>
        </Box>

        {menuOpen ? (
          <Box sx={{ maxHeight: 300, overflow: 'auto', bgcolor: '#F7F8FA' }}>
            {AI_OPPORTUNITIES.map((o, i) => (
              <Box
                key={o.id}
                onClick={() => { goTo(i, 0); setMenuOpen(false); }}
                sx={{
                  px: 2, py: 1, cursor: 'pointer', borderBottom: '1px solid #E6E8EB',
                  bgcolor: i === index ? '#E8F0FA' : 'transparent',
                  '&:hover': { bgcolor: '#EDF2F8' },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ fontSize: 10, fontWeight: 800, color: '#8A94A0', width: 34 }}>{o.ref}</Box>
                  <Box sx={{ fontSize: 12.5, fontWeight: i === index ? 700 : 500 }}>{o.title}</Box>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ px: 2.25, py: 1.75 }}>
            {highlight ? (
              <Box
                sx={{
                  fontSize: 13.5, lineHeight: 1.5, color: '#1B242F',
                  borderLeft: '3px solid #FF9900', pl: 1.5, mb: 1.75,
                }}
              >
                {highlight.label}
              </Box>
            ) : null}

            <Section label="Today">{opportunity.painPoint}</Section>
            <Section label="Proposed">{opportunity.proposal}</Section>
            <Section label="Business value">{opportunity.businessValue}</Section>

            <Divider sx={{ my: 1.5 }} />

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
              {opportunity.awsServices.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  size="small"
                  sx={{
                    height: 21, fontSize: 11, fontWeight: 600,
                    bgcolor: '#FFF3E0', color: '#B25E00', border: '1px solid #FFD9A8',
                  }}
                />
              ))}
            </Stack>

            <Stack direction="row" spacing={2.5} sx={{ mb: 1.25 }}>
              <Meta label="Data readiness" value={opportunity.dataReadiness} hint={opportunity.dataNote} />
              <Meta label="Effort" value={opportunity.effort} />
            </Stack>

            <Box sx={{ fontSize: 10.5, color: '#7A838F', lineHeight: 1.45 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>Evidence: </Box>
              {opportunity.evidence}
            </Box>
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.25, bgcolor: '#F7F8FA', borderTop: '1px solid #E6E8EB' }}
        >
          <Box sx={{ fontSize: 11, color: '#8A94A0' }}>
            Opportunity {index + 1} of {total}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small" onClick={prev} disabled={isFirst}
              startIcon={<ChevronLeft size={14} />}
              sx={{ fontSize: 12.5, color: '#4A5561', minWidth: 0 }}
            >
              Back
            </Button>
            <Button
              size="small" variant="contained" onClick={isLast ? close : next}
              sx={{
                fontSize: 12.5, fontWeight: 700, bgcolor: '#FF9900', color: '#161E2A',
                boxShadow: 'none', px: 2, '&:hover': { bgcolor: '#E88B00', boxShadow: 'none' },
              }}
            >
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: '#8A94A0', mb: 0.35 }}>
        {label.toUpperCase()}
      </Box>
      <Box sx={{ fontSize: 12.5, lineHeight: 1.5, color: '#2B3541' }}>{children}</Box>
    </Box>
  );
}

function Meta({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box>
      <Box sx={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: '#8A94A0' }}>
        {label.toUpperCase()}
      </Box>
      <Box sx={{ fontSize: 12.5, fontWeight: 700, color: '#2B3541' }}>{value}</Box>
      {hint ? <Box sx={{ fontSize: 10.5, color: '#8A94A0', maxWidth: 200 }}>{hint}</Box> : null}
    </Box>
  );
}
