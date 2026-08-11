import { Box, Stack } from '@mui/material';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

/**
 * The dark slate navigation bar at the top of every FileMaker layout.
 *
 * Layout, left to right:
 *   [module block] [toolbar icon buttons] [centre title / slot] [right slot]
 *
 * The module block is a darker rectangle carrying the layout name and a chevron.
 * A down chevron means "layout menu", a back chevron means "return to previous".
 */
export function FMHeader({
  module,
  chevron = 'down',
  onModuleClick,
  toolbar,
  center,
  right,
}: {
  module: string;
  chevron?: 'down' | 'back';
  onModuleClick?: () => void;
  toolbar?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Box
      sx={{
        height: FM.headerH,
        flexShrink: 0,
        bgcolor: FM.headerBg,
        color: FM.headerText,
        display: 'flex',
        alignItems: 'stretch',
        position: 'relative',
      }}
    >
      <Box
        onClick={onModuleClick}
        sx={{
          minWidth: 246,
          bgcolor: FM.headerModuleBg,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.75,
          cursor: onModuleClick ? 'pointer' : 'default',
          '&:hover': onModuleClick ? { bgcolor: '#404C5B' } : undefined,
        }}
      >
        {chevron === 'down' ? <ChevronDown size={22} /> : <ChevronLeft size={22} />}
        <Box sx={{ fontSize: 22, fontWeight: 400, letterSpacing: 0.1 }}>{module}</Box>
      </Box>

      {toolbar ? (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.5 }}>
          {toolbar}
        </Stack>
      ) : null}

      {center ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {center}
        </Box>
      ) : (
        <Box sx={{ flex: 1 }} />
      )}

      {right ? (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2 }}>
          {right}
        </Stack>
      ) : null}
    </Box>
  );
}
