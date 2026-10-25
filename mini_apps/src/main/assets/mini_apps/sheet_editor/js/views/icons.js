// Icons — the editor's extra line icons, added to the kit's set (Ui.icons).
(function () {
  'use strict';
  Object.assign(Ui.icons, {
    right: '<path d="M9 5l7 7-7 7"/>', sigma: '<path d="M18 5H6l7 7-7 7h12"/>', print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>',
    paint: '<rect x="4" y="4" width="13" height="6" rx="1.5"/><path d="M17 7h2.5v4.5H11V14"/><rect x="9" y="14" width="4" height="6.5" rx="1"/>', textc: '<path d="M6 17l6-12 6 12M8.3 12.5h7.4"/>',
    bdall: '<path d="M4.5 4.5h15v15h-15zM12 4.5v15M4.5 12h15"/>', bdout: '<path d="M4.5 4.5h15v15h-15z"/><path d="M12 4.5v15M4.5 12h15" opacity=".3"/>', bdin: '<path d="M12 4.5v15M4.5 12h15"/><path d="M4.5 4.5h15v15h-15z" opacity=".3"/>',
    bdh: '<path d="M4.5 12h15"/><path d="M4.5 4.5h15v15h-15zM12 4.5v15" opacity=".3"/>', bdv: '<path d="M12 4.5v15"/><path d="M4.5 4.5h15v15h-15zM4.5 12h15" opacity=".3"/>',
    bdt: '<path d="M4.5 4.5h15"/><path d="M4.5 19.5h15M4.5 4.5v15M19.5 4.5v15M12 4.5v15M4.5 12h15" opacity=".3"/>', bdb: '<path d="M4.5 19.5h15"/><path d="M4.5 4.5h15M4.5 4.5v15M19.5 4.5v15M12 4.5v15M4.5 12h15" opacity=".3"/>',
    bdl: '<path d="M4.5 4.5v15"/><path d="M4.5 4.5h15M4.5 19.5h15M19.5 4.5v15M12 4.5v15M4.5 12h15" opacity=".3"/>', bdr: '<path d="M19.5 4.5v15"/><path d="M4.5 4.5h15M4.5 19.5h15M4.5 4.5v15M12 4.5v15M4.5 12h15" opacity=".3"/>',
    bdn: '<path d="M4.5 4.5h15v15h-15zM12 4.5v15M4.5 12h15" opacity=".3"/>', valtop: '<path d="M5 5h14M12 9v10M8.5 12.5L12 9l3.5 3.5"/>', valmid: '<path d="M5 12h14M12 5v4M12 15v4M9 8l3 3 3-3M9 16l3-3 3 3"/>', valbot: '<path d="M5 19h14M12 5v10M8.5 11.5L12 15l3.5-3.5"/>',
    dec0: '<path d="M4 17h2M4.5 7.5h3v4h-3zM10.5 7.5h3v4h-3zM17 17h2M14 12.5L10.5 16M10.5 12.5L14 16"/>', decless: '<path d="M4 17h2M11 8l-3 4M15 13h5M8 12h6M11.5 7h3v4h-3z"/>', decmore: '<path d="M17 17h2M4 12h5M6.5 9.5v5M12 7.5h3v4h-3zM17 7.5h3v4h-3z"/>',
    wrap: '<path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-4M4 18h4M13 15.5l-2.5 2.5 2.5 2.5"/>', percent: '<path d="M18 5L6 19M7.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>', money: '<path d="M12 4v16M16.5 8c0-1.7-2-2.5-4.5-2.5S7.5 6.5 7.5 8.5 9.5 11 12 11.5s4.5 1 4.5 3-2 3-4.5 3-4.5-1-4.5-3"/>',
    viewgrid: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>', viewlist: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
    pagesv: '<rect x="6.5" y="3.5" width="11" height="17" rx="1.6"/><path d="M9.5 8h5M9.5 12h5M9.5 16h3"/>', gridv: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15"/>',
    sheet: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4.5v15M14.8 4.5v15"/>',
    redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0 0 8"/>', alignl: '<path d="M4 7h16M4 12h10M4 17h14"/>', alignc: '<path d="M4 7h16M7 12h10M5 17h14"/>', alignr: '<path d="M4 7h16M10 12h10M6 17h14"/>',
    marker: '<path d="M5 19h6M14 5l5 5-8 8-5-5z"/>', chart: '<path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3"/>', pie: '<path d="M12 4a8 8 0 1 0 8 8h-8z"/><path d="M15 3.5a8 8 0 0 1 5.5 5.5H15z"/>', line: '<path d="M4 18l5-6 4 3 7-9"/>', area: '<path d="M4 18l5-6 4 3 7-9v12H4z"/>',
    rowabove: '<rect x="4" y="12" width="16" height="7" rx="1.5"/><path d="M12 3.5v6M9 6.5h6"/>', rowbelow: '<rect x="4" y="5" width="16" height="7" rx="1.5"/><path d="M12 14.5v6M9 17.5h6"/>',
    colleft: '<rect x="12" y="4" width="7" height="16" rx="1.5"/><path d="M3.5 12h6M6.5 9v6"/>', colright: '<rect x="5" y="4" width="7" height="16" rx="1.5"/><path d="M14.5 12h6M17.5 9v6"/>',
    delrow: '<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M9 12h6"/>', delcol: '<rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M12 9v6"/>',
    freeze: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M9.5 4v16"/>', merge: '<rect x="4" y="7" width="16" height="10" rx="2"/><path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2"/>', filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>', pdf: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20v-16a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9 14h6M9 17h4"/>', csv: '<path d="M4 6h16M4 12h16M4 18h16M9 6v12M15 6v12"/>', hide: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  });
})();
