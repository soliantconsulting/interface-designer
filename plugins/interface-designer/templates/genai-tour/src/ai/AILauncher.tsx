import { Box, Button, Stack } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { Play, Sparkles } from 'lucide-react';
import { useAITour } from './AIProvider';
import { AI_OPPORTUNITIES } from './aiOpportunities';

const breathe = keyframes`
  0%, 100% { box-shadow: 0 16px 44px rgba(255,153,0,0.30), 0 0 0 0 rgba(255,153,0,0.42); }
  50%      { box-shadow: 0 16px 44px rgba(255,153,0,0.42), 0 0 0 9px rgba(255,153,0,0.00); }
`;

/**
 * Floating entry point for the pitch. Deliberately modern and AWS-branded so it reads
 * as commentary sitting on top of the legacy system, not part of it.
 */
export function AILauncher() {
  const { isOpen, open, index, highlightIndex } = useAITour();

  if (isOpen || AI_OPPORTUNITIES.length === 0) return null;

  const started = index > 0 || highlightIndex > 0;

  return (
    <Box sx={{ position: 'fixed', right: 22, bottom: 22, zIndex: 1800 }}>
      <Button
        onClick={() => open()}
        sx={{
          bgcolor: '#232F3E',
          color: '#fff',
          pl: 1.1,
          pr: 2.25,
          py: 1.1,
          borderRadius: 999,
          border: '1px solid rgba(255,153,0,0.4)',
          textTransform: 'none',
          animation: `${breathe} 2.8s ease-in-out infinite`,
          '&:hover': { bgcolor: '#31404F', borderColor: '#FF9900' },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              bgcolor: '#FF9900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={13} fill="#161E2A" color="#161E2A" style={{ marginLeft: 2 }} />
          </Box>
          <Stack spacing={0} alignItems="flex-start">
            <Stack direction="row" spacing={0.4} alignItems="center">
              <Sparkles size={9} color="#FF9900" />
              <Box sx={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.6, color: '#FF9900' }}>
                AI OPPORTUNITIES
              </Box>
            </Stack>
            <Box sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>
              {started
                ? 'Resume where you left off'
                : `See ${AI_OPPORTUNITIES.length} ways AI could help here`}
            </Box>
          </Stack>
        </Stack>
      </Button>
    </Box>
  );
}
