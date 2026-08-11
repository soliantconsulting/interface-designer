import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

/**
 * A FileMaker portal: a bordered, scrollable box of related records embedded in a
 * layout. Distinct from a list view in that it always shows its border and its own
 * scrollbar, and it sits inside a form rather than filling the window.
 */
export function FMPortal({
  height,
  children,
  bare = false,
  ...rest
}: {
  height?: number | string;
  children: ReactNode;
  bare?: boolean;
} & Record<`data-${string}`, unknown>) {
  return (
    <Box
      {...rest}
      sx={{
        height,
        border: bare ? 'none' : `1px solid ${FM.borderStrong}`,
        bgcolor: FM.bodyBg,
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

/** Alternating row inside a portal. */
export function FMPortalRow({
  index,
  height = FM.rowH,
  selected = false,
  children,
  ...rest
}: {
  index: number;
  height?: number;
  selected?: boolean;
  children: ReactNode;
} & Record<`data-${string}`, unknown>) {
  return (
    <Box
      {...rest}
      sx={{
        height,
        display: 'flex',
        alignItems: 'center',
        bgcolor: selected ? FM.rowSelectedBg : index % 2 ? FM.rowAltBg : FM.bodyBg,
        borderBottom: `1px solid ${FM.border}`,
        fontSize: FM.fontSize,
        px: 0.5,
      }}
    >
      {children}
    </Box>
  );
}
