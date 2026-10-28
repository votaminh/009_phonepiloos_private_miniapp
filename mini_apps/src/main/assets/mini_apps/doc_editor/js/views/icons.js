// Icons — the editor's extra line icons, added to the kit's set (Ui.icons).
(function () {
  'use strict';
  Object.assign(Ui.icons, {
    viewgrid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>', viewlist: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
    pages: '<rect x="6.5" y="3.5" width="11" height="17" rx="1.6"/><path d="M9.5 8h5M9.5 12h5M9.5 16h3"/>', reflow: '<path d="M4 6.5h16M4 12h10.5a3 3 0 0 1 0 6H12"/><path d="M14 15.5L11.5 18 14 20.5M4 18h4"/>',
    redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0 0 8"/>', alignl: '<path d="M4 7h16M4 12h10M4 17h14"/>', alignc: '<path d="M4 7h16M7 12h10M5 17h14"/>', alignr: '<path d="M4 7h16M10 12h10M6 17h14"/>', alignj: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    numlist: '<path d="M10 7h10M10 12h10M10 17h10"/><path d="M4 5.5l1.5-1v4M4 11.5h2.5L4 14.5h2.5M4 16.5h2.5V18H4.5M6.5 18H4" stroke-width="1.3"/>', indent: '<path d="M11 7h9M11 12h9M4 17h16M4 9l3 3-3 3"/>', outdent: '<path d="M11 7h9M11 12h9M4 17h16M7 9l-3 3 3 3"/>',
    table: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M9.2 5v14M14.8 5v14"/>', camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.3"/>',
    divider: '<path d="M4 12h16"/><path d="M7 7h10M7 17h10" opacity=".4"/>', pagebreak: '<path d="M7 3.5h10v6H7zM7 14.5h10v6H7z"/><path d="M3.5 12h3M9 12h2M13 12h2M17.5 12h3"/>', grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>',
    marker: '<path d="M5 19h6M14 5l5 5-8 8-5-5z"/>', doc: '<path d="M7 3.5h7.5L19 8v12a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h5M10 12.5h6M10 16h4"/>', book: '<path d="M4 19V5.5A1.5 1.5 0 0 1 5.5 4H11v15M20 19V5.5A1.5 1.5 0 0 0 18.5 4H13v15"/><path d="M3 19h18"/>',
    clip: '<rect x="6" y="5" width="12" height="15" rx="2"/><path d="M9 5V4h6v1M9 11h6M9 15h4"/>', pdf: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20v-16a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9 14h6M9 17h4"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    addabove: '<path d="M5 20h14M12 14V4M8 8l4-4 4 4"/>', addbelow: '<path d="M5 4h14M12 10v10M8 16l4 4 4-4"/>', rowabove: '<rect x="4" y="12" width="16" height="7" rx="1.5"/><path d="M12 3.5v6M9 6.5h6"/>', rowbelow: '<rect x="4" y="5" width="16" height="7" rx="1.5"/><path d="M12 14.5v6M9 17.5h6"/>',
    colleft: '<rect x="12" y="4" width="7" height="16" rx="1.5"/><path d="M3.5 12h6M6.5 9v6"/>', colright: '<rect x="5" y="4" width="7" height="16" rx="1.5"/><path d="M14.5 12h6M17.5 9v6"/>', delrow: '<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M9 12h6"/>', delcol: '<rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M12 9v6"/>', scissors: '<circle cx="6.5" cy="7" r="2.4"/><circle cx="6.5" cy="17" r="2.4"/><path d="M8.6 8.2 19 15M8.6 15.8 19 9"/>'
  });
  // for the right-click menu
  Object.assign(Ui.icons, {
    comment: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4 3.5V16h-.5A1.5 1.5 0 0 1 5 14.5z"/><path d="M9 8.5h6M9 11.5h4"/>',
    footnote: '<path d="M5 6h12M5 10h8"/><path d="M5 15.5h14" stroke-width="1.3"/><path d="M5.5 19.5h6"/><path d="M16.5 17.5v3M15.2 18.2l2.6 1.6M17.8 18.2l-2.6 1.6" stroke-width="1.3"/>',
    deltable: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M9.2 5v14M14.8 5v14" opacity=".35"/><path d="M10 12.2l4.6 4.6M14.6 12.2L10 16.8"/>',
    merge: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M12 6v3M12 15v3"/><path d="M7.5 12h9M10 9.5L7.5 12 10 14.5M14 9.5l2.5 2.5-2.5 2.5"/>',
    split: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M12 6v12"/><path d="M9.5 12H5.5M7 10.3L5.5 12 7 13.7M14.5 12h4M17 10.3l1.5 1.7-1.5 1.7"/>',
    selectall: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8.7 12.3l2.3 2.4 4.4-4.9"/>',
    rotl: '<path d="M5 4v4.2h4.2"/><path d="M5.6 8.2A8 8 0 1 1 4.4 13"/>',
    rotr: '<path d="M19 4v4.2h-4.2"/><path d="M18.4 8.2A8 8 0 1 0 19.6 13"/>',
    crop: '<path d="M7 3v14h14M3 7h14v14"/>',
    wrap: '<rect x="4" y="5" width="7" height="7" rx="1"/><path d="M14 6h6M14 10h6M4 16h16M4 20h10"/>',
    openlink: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'
  });
})();
