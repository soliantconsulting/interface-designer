import { Box, Stack } from '@mui/material';
import { FM } from '../../theme/filemakerTheme';

export interface FMTab {
  id: string;
  label: string;
  /** Optional per-tab text colour, used on layouts where tabs are colour coded. */
  color?: string;
}

/**
 * FileMaker tab control. Square cornered, butted together, active tab is white and
 * joins the panel below it by hiding the shared border.
 */
export function FMTabs({
  tabs,
  active,
  onChange,
  ...rest
}: {
  tabs: FMTab[];
  active: string;
  onChange?: (id: string) => void;
} & Record<`data-${string}`, unknown>) {
  return (
    <Stack
      direction="row"
      spacing={0}
      sx={{ borderBottom: `1px solid ${FM.borderStrong}`, flexShrink: 0 }}
      {...rest}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Box
            key={t.id}
            onClick={() => onChange?.(t.id)}
            sx={{
              px: 2.5,
              py: 1,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              color: t.color ?? (isActive ? FM.text : FM.label),
              bgcolor: isActive ? FM.bodyBg : FM.panelBg,
              border: `1px solid ${FM.borderStrong}`,
              borderBottom: isActive ? `1px solid ${FM.bodyBg}` : `1px solid ${FM.borderStrong}`,
              marginBottom: '-1px',
              borderRight: 'none',
              '&:last-of-type': { borderRight: `1px solid ${FM.borderStrong}` },
              cursor: 'default',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </Box>
        );
      })}
    </Stack>
  );
}
