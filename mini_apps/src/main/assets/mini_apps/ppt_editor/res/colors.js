// Colors — the ONLY file where a colour value is written. Use C('name') in JS and var(--name) in CSS (underscore becomes hyphen).
// Look: cool grey ground, burnt orange accent (the colour of a slide deck), a dark stage so slides stand out. The slides themselves draw their own colours from the file.
window.AppColors = {
  bg: '#F4F3F7', card: '#FFFFFF', ink: '#17161C', ink_soft: '#3A3946', muted: '#62606B', line: '#DEDCE4', chip: '#E7E5EC', white: '#FFFFFF',
  accent: '#BF4A0A', accent_hi: '#E0702A', accent_soft: '#FCE7DA', accent_text: '#8A3406', on_accent: '#FFFFFF', dark: '#0F0E12',
  danger: '#A8281F', ok: '#157A6A', warn: '#B3591A', warn_soft: '#FCEBDD', warn_ink: '#7A3A05', ok_soft: '#E6F3EF', ok_ink: '#145C4F',
  surface: '#FBFAFD', stage: '#2A2830', stage_line: '#4A4753', scroll_thumb: 'rgba(23,22,28,.35)', pill_bg: 'rgba(255,255,255,.14)',
  sw_black: '#17161C', sw_gray: '#62606B', sw_red: '#B3261E', sw_orange: '#BF4A0A', sw_green: '#1E7A52', sw_blue: '#1F5FBF', sw_purple: '#6B3FA0', sw_white: '#FFFFFF', sw_navy: '#1B2340', sw_teal: '#1F8A7A',
  fl_none: 'none', fl_sand: '#F1DFC9', fl_mint: '#BFE6DF', fl_sky: '#C9D9F5', fl_lilac: '#DCD3F0', fl_yellow: '#FFE9A6',
  laser: '#FF3B2F', find_hit: '#FFE9A6', find_cur: '#FFB84D', sel_fill: 'rgba(224,112,42,.08)', handle: '#FFFFFF',
  shadow_op: '#00000066', scrim: 'rgba(23,22,28,.5)', shadow: 'rgba(23,22,28,.10)', shadow_hi: 'rgba(23,22,28,.26)', glow: 'rgba(191,74,10,.32)', tip: '#17161C', white_soft: '#E7E5EC'
};

// The four looks of a deck (colours go into the deck's theme, so every slide is restyled; bg and ac are the little preview).
window.AppLooks = {
  tide: { bg: '#1B2340', ac: '#BF4A0A', colors: { dk1: '#1B2340', lt1: '#FFFFFF', dk2: '#2E3A66', lt2: '#F1DFC9', accent1: '#BF4A0A', accent2: '#1F8A7A', accent3: '#3F5FD0', accent4: '#E0702A', accent5: '#8A3FB0', accent6: '#62606B' }, major: 'Calibri', minor: 'Calibri' },
  paper: { bg: '#F6EEE3', ac: '#1B2340', colors: { dk1: '#2B2118', lt1: '#FBF6EE', dk2: '#5B3A1E', lt2: '#F6EEE3', accent1: '#1B2340', accent2: '#B3591A', accent3: '#1E7A52', accent4: '#8A3406', accent5: '#6B3FA0', accent6: '#62606B' }, major: 'Georgia', minor: 'Calibri' },
  night: { bg: '#17161C', ac: '#3FD0B0', colors: { dk1: '#F4F3F7', lt1: '#17161C', dk2: '#B9B7C4', lt2: '#2A2830', accent1: '#3FD0B0', accent2: '#E0702A', accent3: '#7FA6FF', accent4: '#FFD60A', accent5: '#C58AF0', accent6: '#8E8C9A' }, major: 'Calibri', minor: 'Calibri' },
  fresh: { bg: '#FFFFFF', ac: '#1F8A7A', colors: { dk1: '#17594F', lt1: '#FFFFFF', dk2: '#1F8A7A', lt2: '#E6F3EF', accent1: '#1F8A7A', accent2: '#BF4A0A', accent3: '#3F5FD0', accent4: '#E0B02A', accent5: '#8A3FB0', accent6: '#62606B' }, major: 'Calibri', minor: 'Calibri' }
};
