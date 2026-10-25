// Colors — the ONLY file where a colour value is written. Use C('name') in JS and var(--name) in CSS (underscore becomes hyphen).
// Look: PiloOS Home Reskin (warm paper, ink) with one green, the colour of a spreadsheet. The grid itself is always white: it is the user's data.
window.AppColors = {
  bg: '#F4F2EE', card: '#FFFFFF', ink: '#15171C', ink_soft: '#3A3E46', muted: '#5F636C', line: '#DDD9D1', chip: '#E4E1DA', white: '#FFFFFF',
  accent: '#1E7A52', accent_hi: '#2E9A68', accent_soft: '#DDF0E6', accent_text: '#145C3C', on_accent: '#FFFFFF', dark: '#14161B',
  danger: '#C23B3B', ok: '#157A6A', warn: '#B3591A', warn_soft: '#FCEBDD', warn_ink: '#9A4A06',
  surface: '#FBFAF8', stage: '#E9E7E2', head_bg: '#ECEAE4', head_line: '#D9D5CC', cell_line: '#E1DED6', cell_head: '#F1EFEA',
  sw_black: '#15171C', sw_gray: '#5F636C', sw_red: '#B3261E', sw_orange: '#B3591A', sw_green: '#1E7A52', sw_blue: '#1F5FBF', sw_purple: '#6B3FA0',
  fl_none: '#FFFFFF', fl_yellow: '#F2C94C', fl_pink: '#F5B7B1', fl_peach: '#F8D3B0', fl_mint: '#BFE3CF', fl_sky: '#BBD4F2', fl_lilac: '#D9C8EE',
  stat_mute: '#C9CCD3', quick_line: '#3A3D45',
  scrim: 'rgba(21,23,28,.5)', shadow: 'rgba(21,23,28,.10)', shadow_hi: 'rgba(21,23,28,.26)', glow: 'rgba(30,122,82,.32)', tip: '#15171C'
};
// the series colours of a chart that names none (Office's own order), and the chart's quiet lines and text
window.ChartLook = { series: ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#2C4D75', '#772C2A', '#5F7530', '#4D3B62'], grid: '#D9D9D9', axis: '#8C8C8C', text: '#404040', back: '#FFFFFF', bar: '#638EC6' };
