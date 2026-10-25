// Colors — the ONLY file where a colour value is written. Use C('name') in JS and var(--name) in CSS (underscore becomes hyphen).
// Look: PiloOS Home Reskin (warm paper, ink) with one green, the colour of a spreadsheet. The grid itself is always white: it is the user's data.
window.AppColors = {
  bg: '#F4F2EE', card: '#FFFFFF', ink: '#15171C', ink_soft: '#3A3E46', muted: '#5F636C', line: '#DDD9D1', chip: '#E4E1DA', white: '#FFFFFF',
  accent: '#1E7A52', accent_hi: '#2E9A68', accent_soft: '#DDF0E6', accent_text: '#145C3C', on_accent: '#FFFFFF', dark: '#14161B',
  danger: '#C23B3B', ok: '#157A6A', warn: '#B3591A', warn_soft: '#FCEBDD', warn_ink: '#9A4A06',
  surface: '#FBFAF8', stage: '#E9E7E2', head_bg: '#ECEAE4', head_line: '#D9D5CC', cell_line: '#E1DED6', cell_head: '#F1EFEA',
  sw_black: '#15171C', sw_gray: '#5F636C', sw_red: '#B3261E', sw_orange: '#B3591A', sw_green: '#1E7A52', sw_blue: '#1F5FBF', sw_purple: '#6B3FA0',
  fl_none: '#FFFFFF', fl_yellow: '#F2C94C', fl_pink: '#F5B7B1', fl_peach: '#F8D3B0', fl_mint: '#BFE3CF', fl_sky: '#BBD4F2', fl_lilac: '#D9C8EE',
  ref_blue: '#2B5CFB', ref_red: '#C23B3B', ref_green: '#157A6A', ref_purple: '#7A3FB0', ref_orange: '#B3591A', ref_teal: '#0F7C94',
  cf_red_bg: '#FFC7CE', cf_red_ink: '#9C0006', cf_yel_bg: '#FFEB9C', cf_yel_ink: '#9C5700', cf_grn_bg: '#C6EFCE', cf_grn_ink: '#006100', cf_blu_bg: '#BDD7EE', cf_blu_ink: '#1F3864', cf_gry_bg: '#E4E1DA', cf_gry_ink: '#3A3E46',
  cf_s_green: '#63BE7B', cf_s_yellow: '#FFEB84', cf_s_red: '#F8696B', cf_s_white: '#FCFCFF', cf_s_blue: '#5A8AC6', cf_s_orange: '#FFB628', cf_s_bar: '#638EC6',
  tb_blue: '#4472C4', tb_blue_band: '#D9E2F3', tb_orange: '#ED7D31', tb_orange_band: '#FBE5D6', tb_gray: '#A5A5A5', tb_gray_band: '#EDEDED', tb_gold: '#FFC000', tb_gold_band: '#FFF2CC', tb_green: '#70AD47', tb_green_band: '#E2EFDA', tb_plain: '#15171C', tb_plain_band: '#F2F2F2',
  shape_fill: '#4472C4', shape_line: '#2F528F',
  stat_mute: '#C9CCD3', quick_line: '#3A3D45',
  scrim: 'rgba(21,23,28,.5)', shadow: 'rgba(21,23,28,.10)', shadow_hi: 'rgba(21,23,28,.26)', glow: 'rgba(30,122,82,.32)', tip: '#15171C'
};
// the series colours of a chart that names none (Office's own order), and the chart's quiet lines and text
window.ChartLook = { series: ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#2C4D75', '#772C2A', '#5F7530', '#4D3B62'], grid: '#D9D9D9', axis: '#8C8C8C', text: '#404040', back: '#FFFFFF', bar: '#638EC6' };

// the colour picker: ten columns like the sheets people know (greys, the vivid row, then lighter and darker shades of each)
window.AppPalette = {
  base: ['#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF'],
  vivid: ['#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF'],
  shades: [
    ['#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC'],
    ['#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD'],
    ['#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0'],
    ['#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79'],
    ['#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47']
  ]
};
