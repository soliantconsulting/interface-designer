import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

/**
 * macOS window chrome. Reproduces the title bar the client sees above every
 * FileMaker layout, including the traffic lights and the "Solution (host)" title.
 *
 * Keeping this on every screen is what makes the separate routes read as one
 * application rather than a set of web pages.
 */
export function FMWindow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: FM.bodyBg,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: 28,
          flexShrink: 0,
          bgcolor: FM.windowBarBg,
          borderBottom: `1px solid #CFCFCF`,
          display: 'flex',
          alignItems: 'center',
          px: 1.25,
          position: 'relative',
          background: 'linear-gradient(#EDEDED, #DFDFDF)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75, zIndex: 1 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <Box
              key={c}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: c,
                border: '0.5px solid rgba(0,0,0,0.12)',
              }}
            />
          ))}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: FM.windowBarText,
            pointerEvents: 'none',
          }}
        >
          {title}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  );
}
