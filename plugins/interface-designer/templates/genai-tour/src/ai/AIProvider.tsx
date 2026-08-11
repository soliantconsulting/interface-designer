import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AI_OPPORTUNITIES, TOTAL_HIGHLIGHTS, type AIHighlight, type AIOpportunity } from './aiOpportunities';

interface AIContextValue {
  isOpen: boolean;
  index: number;
  highlightIndex: number;
  opportunity: AIOpportunity | null;
  highlight: AIHighlight | null;
  total: number;
  totalHighlights: number;
  ordinal: number;
  isFirst: boolean;
  isLast: boolean;
  open: (at?: number, atHighlight?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  goTo: (index: number, highlightIndex?: number) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const clamp = (i: number) => Math.max(0, Math.min(i, AI_OPPORTUNITIES.length - 1));

  const open = useCallback((at?: number, atHighlight = 0) => {
    if (at !== undefined) {
      const i = clamp(at);
      setIndex(i);
      setHighlightIndex(
        Math.max(0, Math.min(atHighlight, (AI_OPPORTUNITIES[i]?.highlights.length ?? 1) - 1)),
      );
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const restart = useCallback(() => {
    setIndex(0);
    setHighlightIndex(0);
    setIsOpen(true);
  }, []);

  const advance = useCallback(
    (dir: 1 | -1) => {
      const o = AI_OPPORTUNITIES[index];
      if (!o) return;
      if (dir === 1) {
        if (highlightIndex < o.highlights.length - 1) setHighlightIndex(highlightIndex + 1);
        else if (index < AI_OPPORTUNITIES.length - 1) {
          setIndex(index + 1);
          setHighlightIndex(0);
        }
      } else if (highlightIndex > 0) setHighlightIndex(highlightIndex - 1);
      else if (index > 0) {
        const prev = AI_OPPORTUNITIES[index - 1];
        setIndex(index - 1);
        setHighlightIndex(prev.highlights.length - 1);
      }
    },
    [index, highlightIndex],
  );

  const goTo = useCallback((i: number, hi = 0) => {
    const c = clamp(i);
    setIndex(c);
    setHighlightIndex(Math.max(0, Math.min(hi, (AI_OPPORTUNITIES[c]?.highlights.length ?? 1) - 1)));
  }, []);

  const opportunity = AI_OPPORTUNITIES[index] ?? null;
  const highlight = opportunity?.highlights[highlightIndex] ?? null;

  const ordinal = useMemo(() => {
    let n = 0;
    for (let i = 0; i < index; i++) n += AI_OPPORTUNITIES[i].highlights.length;
    return n + highlightIndex + 1;
  }, [index, highlightIndex]);

  const isFirst = index === 0 && highlightIndex === 0;
  const isLast =
    index === AI_OPPORTUNITIES.length - 1 &&
    opportunity !== null &&
    highlightIndex === opportunity.highlights.length - 1;

  const value = useMemo<AIContextValue>(
    () => ({
      isOpen,
      index,
      highlightIndex,
      opportunity,
      highlight,
      total: AI_OPPORTUNITIES.length,
      totalHighlights: TOTAL_HIGHLIGHTS,
      ordinal,
      isFirst,
      isLast,
      open,
      close,
      next: () => advance(1),
      prev: () => advance(-1),
      restart,
      goTo,
    }),
    [isOpen, index, highlightIndex, opportunity, highlight, ordinal, isFirst, isLast, open, close, advance, restart, goTo],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAITour() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAITour must be used inside <AIProvider>');
  return ctx;
}
