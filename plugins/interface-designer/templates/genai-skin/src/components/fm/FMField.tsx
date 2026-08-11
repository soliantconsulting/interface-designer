import { Box, Stack } from '@mui/material';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

/**
 * A FileMaker field box. Flat, hairline border, inset value, no MUI label float.
 * `variant="plain"` is the editable white box, `"muted"` is the grey read-only look.
 */
export function FMBox({
  value,
  width,
  align = 'left',
  variant = 'plain',
  bold = false,
  color,
  placeholder,
  fontSize = FM.fontSize,
  ...rest
}: {
  value?: ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  variant?: 'plain' | 'muted' | 'bare';
  bold?: boolean;
  color?: string;
  placeholder?: string;
  fontSize?: number;
} & Record<`data-${string}`, unknown>) {
  const empty = value === undefined || value === null || value === '';
  return (
    <Box
      {...rest}
      sx={{
        width,
        minHeight: FM.fieldH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        px: variant === 'bare' ? 0 : 0.75,
        bgcolor: variant === 'muted' ? FM.panelBg : variant === 'bare' ? 'transparent' : FM.bodyBg,
        border: variant === 'bare' ? 'none' : `1px solid ${FM.fieldBorder}`,
        borderRadius: '2px',
        fontSize,
        fontWeight: bold ? 600 : 400,
        color: color ?? (empty ? FM.textMuted : FM.text),
        lineHeight: 1.25,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}
    >
      {empty ? placeholder ?? '' : value}
    </Box>
  );
}

/**
 * Right-aligned label plus field, the dominant pattern on FileMaker detail layouts.
 * `pencil` renders the small edit affordance seen next to editable fields.
 */
export function FMField({
  label,
  labelWidth = 96,
  pencil = false,
  children,
  ...rest
}: {
  label?: ReactNode;
  labelWidth?: number | string;
  pencil?: boolean;
  children: ReactNode;
} & Record<`data-${string}`, unknown>) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} {...rest}>
      {pencil ? <Pencil size={13} color={FM.label} style={{ flexShrink: 0 }} /> : null}
      {label !== undefined ? (
        <Box
          sx={{
            width: labelWidth,
            flexShrink: 0,
            textAlign: 'right',
            fontSize: FM.fontSize,
            color: FM.label,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Box>
      ) : null}
      {children}
    </Stack>
  );
}

/** The square FileMaker checkbox. */
export function FMCheck({
  checked = false,
  color,
  size = 15,
  ...rest
}: { checked?: boolean; color?: string; size?: number } & Record<`data-${string}`, unknown>) {
  return (
    <Box
      {...rest}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        border: `1px solid ${FM.fieldBorder}`,
        borderRadius: '2px',
        bgcolor: FM.bodyBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size - 3,
        fontWeight: 700,
        color: color ?? FM.positive,
        lineHeight: 1,
      }}
    >
      {checked ? '✓' : ''}
    </Box>
  );
}
