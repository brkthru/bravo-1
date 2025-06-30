import { themeAlpine } from 'ag-grid-community';

// Create light theme based on Alpine theme with custom settings
export const lightTheme = themeAlpine.withParams({
  // Font settings
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,

  // Row heights
  headerHeight: 48,
  rowHeight: 48,

  // Colors
  borderColor: '#e5e7eb',
  headerBackgroundColor: '#f9fafb',
  oddRowBackgroundColor: '#ffffff',

  // Selection colors
  selectedRowBackgroundColor: '#dbeafe',

  // Hover
  rowHoverColor: '#f3f4f6',

  // Grid spacing
  cellHorizontalPadding: 12,
});

// Create dark theme based on Alpine theme with dark mode settings
export const darkTheme = themeAlpine.withParams({
  // Font settings
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,

  // Row heights
  headerHeight: 48,
  rowHeight: 48,

  // Colors - dark mode
  backgroundColor: '#1f2937',
  foregroundColor: '#f3f4f6',
  borderColor: '#374151',
  headerBackgroundColor: '#111827',
  oddRowBackgroundColor: '#1f2937',
  headerTextColor: '#f3f4f6',

  // Selection colors
  selectedRowBackgroundColor: '#374151',

  // Hover
  rowHoverColor: '#374151',

  // Grid spacing
  cellHorizontalPadding: 12,
});
