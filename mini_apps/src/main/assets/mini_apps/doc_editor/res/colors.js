// Colors — the ONLY file where a colour value is written. Use C('name') in JS and var(--name) in CSS (underscore becomes hyphen).
// Look: PiloOS Home Reskin (warm paper, ink, one blue). The page of the document itself is always white: it is the user's document.
window.AppColors = {
  bg: '#F4F2EE', card: '#FFFFFF', ink: '#15171C', ink_soft: '#3A3E46', muted: '#5F636C', line: '#DDD9D1', chip: '#E4E1DA', white: '#FFFFFF',
  accent: '#2B5CFB', accent_hi: '#4F78FF', accent_soft: '#E4EAFE', accent_text: '#1D3FBF', on_accent: '#FFFFFF', dark: '#14161B',
  danger: '#C23B3B', ok: '#157A6A', warn: '#B3591A', warn_soft: '#FCEBDD', warn_ink: '#9A4A06',
  surface: '#FBFAF8', stage: '#E9E7E2', paper: '#FFFFFF', paper_ink: '#15171C', paper_line: '#B9B5AB', paper_muted: '#8A8F98',
  sepia_bg: '#F1E7D0', sepia_ink: '#3B2F1B', sepia_line: '#D8C9A6', night_bg: '#14161B', night_ink: '#E7E6E1', night_head: '#F5F4F0', night_muted: '#A3A7AF', night_line: '#2A2D34', night_chip: '#232A45', night_accent: '#9DB4FF',
  find_hit: '#FFE9A6', find_cur: '#FFB84D', sel: 'rgba(43,92,251,.22)',
  sw_black: '#15171C', sw_red: '#C23B3B', sw_blue: '#2B5CFB', sw_green: '#157A6A', sw_orange: '#B3591A', sw_purple: '#7A3FBF',
  hl_yellow: '#FFF176', hl_green: '#B9F6CA', hl_pink: '#FFC1E3', hl_blue: '#B3E5FC',
  scrim: 'rgba(21,23,28,.5)', shadow: 'rgba(21,23,28,.10)', shadow_hi: 'rgba(21,23,28,.26)', glow: 'rgba(43,92,251,.32)', tip: '#15171C'
};
// the series colours of a chart that names none (Office's own order), and the chart's quiet lines and text
window.ChartLook = { series: ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#2C4D75', '#772C2A', '#5F7530', '#4D3B62'], grid: '#D9D9D9', axis: '#8C8C8C', text: '#404040', back: '#FFFFFF' };
