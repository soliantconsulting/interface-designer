import { Box } from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { FM } from '../../theme/filemakerTheme';

export interface FMColumn<T> {
  key: string;
  header: ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  /** Tint the whole column, as FileMaker report layouts often do. */
  tint?: 'green' | 'blue' | 'amber';
  sorted?: 'asc' | 'desc';
  render: (row: T, index: number) => ReactNode;
}

const tintBg = {
  green: FM.tintGreenBg,
  blue: FM.tintBlueBg,
  amber: FM.tintAmberBg,
} as const;

/**
 * Dense FileMaker list/report grid.
 *
 * Deliberately not MUI DataGrid: that component brings its own density, focus rings,
 * hover elevation and sort affordances, none of which look like FileMaker. This is a
 * plain table with hairline borders and fixed row heights.
 */
export function FMGrid<T>({
  columns,
  rows,
  rowHeight = FM.rowH,
  selectedIndex,
  onRowClick,
  getRowKey,
  stickyHeader = true,
  ...rest
}: {
  columns: FMColumn<T>[];
  rows: T[];
  rowHeight?: number;
  selectedIndex?: number;
  onRowClick?: (row: T, index: number) => void;
  getRowKey: (row: T, index: number) => string | number;
  stickyHeader?: boolean;
} & Record<`data-${string}`, unknown>) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }} {...rest}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: FM.fontSize,
        }}
      >
        <Box component="colgroup">
          {columns.map((c) => (
            <Box component="col" key={c.key} sx={{ width: c.width }} />
          ))}
        </Box>

        <Box component="thead">
          <Box component="tr">
            {columns.map((c) => (
              <Box
                component="th"
                key={c.key}
                sx={{
                  position: stickyHeader ? 'sticky' : undefined,
                  top: 0,
                  zIndex: 2,
                  bgcolor: FM.gridHeaderBg,
                  borderBottom: `1px solid ${FM.borderStrong}`,
                  borderRight: `1px solid ${FM.border}`,
                  color: FM.label,
                  fontSize: FM.fontSizeHeader,
                  fontWeight: 600,
                  textAlign: c.align ?? 'left',
                  px: 0.875,
                  py: 0.75,
                  verticalAlign: 'bottom',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.25,
                    justifyContent:
                      c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start',
                    width: '100%',
                  }}
                >
                  {c.sorted === 'asc' ? <ChevronUp size={11} /> : null}
                  {c.sorted === 'desc' ? <ChevronDown size={11} /> : null}
                  {c.header}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="tbody">
          {rows.map((row, i) => {
            const selected = selectedIndex === i;
            return (
              <Box
                component="tr"
                key={getRowKey(row, i)}
                onClick={() => onRowClick?.(row, i)}
                sx={{
                  height: rowHeight,
                  bgcolor: selected ? FM.rowSelectedBg : i % 2 ? FM.rowAltBg : FM.bodyBg,
                  cursor: onRowClick ? 'default' : undefined,
                  '&:hover': !selected && onRowClick ? { bgcolor: FM.rowHoverBg } : undefined,
                }}
              >
                {columns.map((c) => (
                  <Box
                    component="td"
                    key={c.key}
                    sx={{
                      borderBottom: `1px solid ${FM.border}`,
                      borderRight: `1px solid ${FM.border}`,
                      bgcolor: !selected && c.tint ? tintBg[c.tint] : undefined,
                      color: c.tint === 'green' ? FM.tintGreenText : undefined,
                      textAlign: c.align ?? 'left',
                      px: 0.875,
                      py: 0.5,
                      verticalAlign: 'top',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                    }}
                  >
                    {c.render(row, i)}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
