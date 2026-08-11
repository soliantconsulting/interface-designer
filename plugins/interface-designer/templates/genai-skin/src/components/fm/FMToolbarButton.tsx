import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

/**
 * The rounded-rectangle icon buttons in the FileMaker header bar.
 * Label is optional; most are icon only.
 */
export function FMToolbarButton({
  icon,
  label,
  onClick,
  width,
  ...rest
}: {
  icon?: ReactNode;
  label?: ReactNode;
  onClick?: () => void;
  width?: number | string;
} & Record<`data-${string}`, unknown>) {
  return (
    <Box
      onClick={onClick}
      {...rest}
      sx={{
        minWidth: width ?? 40,
        height: 38,
        px: label ? 1.75 : 0,
        bgcolor: FM.toolbarBtnBg,
        color: FM.headerText,
        borderRadius: '5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'default',
        userSelect: 'none',
        '&:hover': { bgcolor: FM.toolbarBtnHover },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}
