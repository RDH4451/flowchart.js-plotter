/* Plotter: static flowchart.js editor. */
(function () {
  'use strict';

  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };
  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';
  var LS_KEY = 'plotter.state.v1';
  var EDGE_SIDES = ['top', 'right', 'bottom', 'left'];
  var EDGE_SIDE_SET = { top: true, right: true, bottom: true, left: true };
  var EDGE_SIDE_LABELS = { top: '上', right: '右', bottom: '下', left: '左' };
  var EDGE_BRANCH_SET = { next: true, yes: true, no: true, path1: true, path2: true, path3: true };
  var FLOW_META_LINE_RE = /^\s*(?:\/\/|#)\s*@plotter(?:-meta|-layout)?\s*:?\s*(\{.*\})\s*$/;
  var HISTORY_LIMIT = 100;
  var TEXT_HISTORY_COALESCE_MS = 600;

  var FONTS = {
    sans: { label: '无衬线', stack: 'Arial, Helvetica, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' },
    serif: { label: '衬线', stack: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif' },
    mono: { label: '等宽', stack: '"Courier New", Courier, "PingFang SC", "Microsoft YaHei", monospace' },
    system: { label: '系统界面', stack: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' }
  };

  var THEMES = {
    drafting: {
      label: '制图',
      swatch: { bg: '#f7f5ee', ink: '#1b1e17', fill: '#f7f5ee' },
      flow: {
        'font-color': '#1b1e17',
        'line-color': '#1b1e17',
        'element-color': '#1b1e17',
        fill: '#f7f5ee',
        symbols: {
          start: { fill: '#e4572e', 'font-color': '#f7f5ee', 'element-color': '#1b1e17' },
          end: { fill: '#1b1e17', 'font-color': '#f7f5ee', 'element-color': '#1b1e17' },
          condition: { fill: '#ffffff' }
        },
        flowstate: {
          past: { fill: '#e9e5d8', 'font-color': '#7a7f70' },
          current: { fill: '#f6d6c8', 'font-color': '#a8330f', 'font-weight': 'bold' },
          approved: { fill: '#dce8d5', 'font-color': '#2f5b33' },
          rejected: { fill: '#f3d9d3', 'font-color': '#8c2f1d' },
          invalid: { fill: '#e2e0d8', 'font-color': '#8a8578' }
        }
      }
    },
    blueprint: {
      label: '蓝图',
      swatch: { bg: '#0e2a47', ink: '#a9cde8', fill: '#0e2a47' },
      flow: {
        'font-color': '#d8e9f8',
        'line-color': '#8fc1e8',
        'element-color': '#8fc1e8',
        fill: '#0e2a47',
        symbols: {
          start: { fill: '#f2c14e', 'font-color': '#0e2a47', 'element-color': '#f2c14e' },
          end: { fill: '#8fc1e8', 'font-color': '#0e2a47', 'element-color': '#8fc1e8' },
          condition: { fill: '#0e2a47', 'element-color': '#d8e9f8' }
        },
        flowstate: {
          past: { fill: '#12324f', 'font-color': '#7fa2bf' },
          current: { fill: '#f2c14e', 'font-color': '#0e2a47', 'font-weight': 'bold' },
          approved: { fill: '#1e4b57' },
          rejected: { fill: '#4a2338' },
          invalid: { fill: '#1a2634', 'font-color': '#8aa0b2' }
        }
      }
    },
    graphite: {
      label: '石墨',
      swatch: { bg: '#17191d', ink: '#b9c0cc', fill: '#17191d' },
      flow: {
        'font-color': '#e7eaef',
        'line-color': '#aab2bf',
        'element-color': '#aab2bf',
        fill: '#17191d',
        symbols: {
          start: { fill: '#f0b429', 'font-color': '#17191d', 'element-color': '#f0b429' },
          end: { fill: '#aab2bf', 'font-color': '#17191d', 'element-color': '#aab2bf' }
        },
        flowstate: {
          past: { fill: '#1e2126', 'font-color': '#8c93a0' },
          current: { fill: '#f0b429', 'font-color': '#17191d', 'font-weight': 'bold' },
          approved: { fill: '#25352a' },
          rejected: { fill: '#3a2426' },
          invalid: { fill: '#22252a', 'font-color': '#7e8590' }
        }
      }
    },
    riso: {
      label: '丝印',
      swatch: { bg: '#f6f1e6', ink: '#2233b3', fill: '#f6f1e6' },
      flow: {
        'font-color': '#2233b3',
        'line-color': '#2233b3',
        'element-color': '#2233b3',
        fill: '#f6f1e6',
        symbols: {
          start: { fill: '#ff4d6d', 'font-color': '#ffffff', 'element-color': '#2233b3' },
          end: { fill: '#2233b3', 'font-color': '#f6f1e6', 'element-color': '#2233b3' },
          condition: { fill: '#ffd9e0', 'element-color': '#2233b3' }
        },
        flowstate: {
          past: { fill: '#e7e0ce', 'font-color': '#6e719e' },
          current: { fill: '#ffd9e0', 'font-weight': 'bold' },
          approved: { fill: '#d6e4c9', 'font-color': '#2c5c36' },
          rejected: { fill: '#ffd0d9', 'font-color': '#a3203a' },
          invalid: { fill: '#e4ded0' }
        }
      }
    },
    mono: {
      label: '单色',
      swatch: { bg: '#ffffff', ink: '#111111', fill: '#ffffff' },
      flow: {
        'font-color': '#111111',
        'line-color': '#111111',
        'element-color': '#111111',
        fill: '#ffffff',
        symbols: {
          start: { fill: '#ffffff' },
          end: { fill: '#111111', 'font-color': '#ffffff' }
        },
        flowstate: {
          past: { fill: '#eeeeee' },
          current: { fill: '#f2f2f2', 'font-weight': 'bold' },
          approved: { fill: '#e8f0e4' },
          rejected: { fill: '#f6e4e1' },
          invalid: { fill: '#e4e4e4', 'font-color': '#777777' }
        }
      }
    }
  };

  var NODE_GLYPHS = {
    start: '<svg viewBox="0 0 26 16"><rect x="2" y="3" width="22" height="10" rx="5"/></svg>',
    end: '<svg viewBox="0 0 26 16"><rect x="2" y="3" width="22" height="10" rx="5"/><rect x="2" y="3" width="22" height="10" rx="5" fill="currentColor" opacity=".18"/></svg>',
    operation: '<svg viewBox="0 0 26 16"><rect x="2" y="3" width="22" height="10"/></svg>',
    inputoutput: '<svg viewBox="0 0 26 16"><path d="M6 3h18l-4 10H2z"/></svg>',
    input: '<svg viewBox="0 0 26 16"><path d="M5 3h18l-3 10H2z"/></svg>',
    output: '<svg viewBox="0 0 26 16"><path d="M3 3h18l3 10H6z"/></svg>',
    subroutine: '<svg viewBox="0 0 26 16"><rect x="2" y="3" width="22" height="10"/><path d="M6 3v10M20 3v10"/></svg>',
    condition: '<svg viewBox="0 0 26 16"><path d="M13 2l11 6-11 6L2 8z"/></svg>',
    parallel: '<svg viewBox="0 0 26 16"><rect x="2" y="3" width="22" height="10"/><path d="M9 3v10M17 3v10"/></svg>'
  };

  var NODE_LABELS = {
    start: '开始',
    end: '结束',
    operation: '操作',
    inputoutput: '输入输出',
    input: '输入',
    output: '输出',
    subroutine: '子流程',
    condition: '条件',
    parallel: '并行'
  };

  var SNIPPETS = {
    start: 'st=>start: 开始',
    end: 'e=>end: 结束',
    operation: 'op=>operation: 步骤',
    inputoutput: 'io=>inputoutput: 输入 / 输出',
    input: 'in=>input: 输入',
    output: 'out=>output: 输出',
    subroutine: 'sub=>subroutine: 子流程',
    condition: 'cond=>condition: 是或否？',
    parallel: 'para=>parallel: 并行任务'
  };

  var EXAMPLE_GLYPHS = {
    flow: '<svg viewBox="0 0 20 20"><rect x="6" y="1.5" width="8" height="3.5" rx="1.75"/><path d="M10 5v3M10 8l-4 3v3M10 8l4 3v3"/><rect x="3" y="14" width="6" height="4"/><rect x="11" y="14" width="6" height="4"/></svg>',
    branch: '<svg viewBox="0 0 20 20"><rect x="6" y="1.5" width="8" height="3.5" rx="1.75"/><path d="M10 5v2.5M10 7.5L5 11v3M10 7.5l5 3.5v3"/><path d="M10 7.5l5 3.5"/><rect x="2" y="14" width="6" height="4"/><rect x="12" y="14" width="6" height="4"/></svg>',
    parallel: '<svg viewBox="0 0 20 20"><rect x="7" y="1.5" width="6" height="3"/><path d="M10 4.5v2M4 9.5v-1h12v1M4 8.5v3M10 8.5v3M16 8.5v3"/><rect x="1" y="12" width="6" height="4"/><rect x="7" y="12" width="6" height="4"/><rect x="13" y="12" width="6" height="4"/></svg>',
    link: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="5" rx="1"/><path d="M6 7v2h8V7M10 9v3"/><path d="M7.5 14.5l2.5-2 2.5 2-2.5 2z"/></svg>',
    state: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="4"/><rect x="2" y="8" width="16" height="4" fill="currentColor" opacity=".25"/><rect x="2" y="13" width="16" height="4"/></svg>',
    style: '<svg viewBox="0 0 20 20"><path d="M3 16c4-9 10-9 14 0" fill="none"/><circle cx="3" cy="16" r="1.6"/><circle cx="17" cy="16" r="1.6"/><path d="M6 3h8M10 3v6"/></svg>'
  };

  var EXAMPLES = [
    {
      name: '你好，流程',
      desc: '最小可用的图：一个分支和一个回环。',
      glyph: EXAMPLE_GLYPHS.flow,
      source: [
        'st=>start: 开始',
        'in=>input: 你的想法',
        'op=>operation: 起草',
        'cond=>condition: 够好了吗？',
        'fix=>operation: 修改',
        'out=>output: 发布',
        'e=>end: 完成',
        '',
        'st->in->op->cond',
        'cond(no)->fix->op',
        'cond(yes)->out->e'
      ].join('\n')
    },
    {
      name: '部署流水线',
      desc: '带回滚环节的发布流程。',
      glyph: EXAMPLE_GLYPHS.branch,
      source: [
        'st=>start: 合并到主分支',
        'tests=>operation: 运行测试',
        'pass=>condition: 全部通过？',
        'build=>operation: 构建镜像',
        'stage=>subroutine: 部署到预发',
        'qa=>condition: 验收通过？',
        'prod=>subroutine: 部署到生产',
        'rollback=>operation: 回滚',
        'e=>end: 发布上线',
        '',
        'st->tests->pass',
        'pass(yes)->build->stage->qa',
        'pass(no)->rollback->e',
        'qa(yes)->prod->e',
        'qa(no)->rollback'
      ].join('\n')
    },
    {
      name: '发布状态',
      desc: '流程状态与可点击链接。',
      glyph: EXAMPLE_GLYPHS.state,
      source: [
        'st=>start: 新版本|past:>https://flowchart.js.org[blank]',
        'plan=>operation: 写计划|past',
        'code=>operation: 开发|current',
        'review=>condition: 评审通过？|future',
        'fix=>operation: 修复问题|future',
        'ship=>inputoutput: 发布|future',
        'e=>end: 庆祝|future',
        '',
        'st->plan->code->review',
        'review(no)->fix->code',
        'review(yes)->ship->e'
      ].join('\n')
    },
    {
      name: '并行任务',
      desc: '拆分三项任务，再汇合完成。',
      glyph: EXAMPLE_GLYPHS.parallel,
      source: [
        'st=>start: 收到订单',
        'para=>parallel: 三项任务',
        'stock=>operation: 检查库存',
        'pay=>operation: 扣款',
        'mail=>operation: 发送收据',
        'e=>end: 完成',
        '',
        'st->para',
        'para(path1, bottom)->stock',
        'para(path2, right)->pay',
        'para(path3, left)->mail',
        'stock->e',
        'pay->e',
        'mail->e'
      ].join('\n')
    },
    {
      name: '审批回环',
      desc: '带修订回环的审批流程。',
      glyph: EXAMPLE_GLYPHS.link,
      source: [
        'st=>start: 草稿送达',
        'read=>input: 阅读草稿',
        'check=>condition: 通过？',
        'note=>operation: 留下批注',
        'edit=>operation: 修改草稿',
        'e=>end: 发布',
        '',
        'st->read->check',
        'check(no)->note->edit->read',
        'check(yes)->e'
      ].join('\n')
    },
    {
      name: '强调路径',
      desc: '用 @> 注释高亮一条路线。',
      glyph: EXAMPLE_GLYPHS.style,
      source: [
        'st=>start: 启动',
        'a=>operation: 调研',
        'b=>operation: 原型',
        'c=>condition: 有用吗？',
        'd=>operation: 打磨',
        'e=>end: 分享',
        '',
        'st->a->b->c',
        'c(yes)->d->e',
        'c(no)->a',
        '',
        'st@>a({"stroke":"#e4572e"})@>b({"stroke":"#e4572e"})@>c({"stroke":"#e4572e"})@>d({"stroke":"#e4572e"})@>e({"stroke":"#e4572e","stroke-width":6})'
      ].join('\n')
    }
  ];

  var state = {
    title: '未命名流程图',
    source: '',
    theme: 'drafting',
    style: {
      fontSize: 14,
      lineWidth: 3,
      lineLength: 50,
      textMargin: 10,
      font: 'sans',
      arrow: 'classic',
      yes: '是',
      no: '否',
      animate: true,
      jumps: true
    },
    grid: true,
    frame: true,
    layout: {},
    edges: [],
    hiddenEdges: [],
    editorWidth: 42,
    mobilePane: 'source',
    export: { format: 'png', scale: 2, bg: 'sheet', pad: 24, links: true }
  };

  var el = {};
  var stage = null;
  var lastSvg = null;
  var lastChart = null;
  var nodeDrag = null;
  var nodeDragFrame = 0;
  var marqueeDrag = null;
  var currentEdges = [];
  var hiddenEdgeCount = 0;
  var tidyLayout = null;
  var selectedEdgeKey = '';
  var selectedNodeKeys = [];
  var hoveredNodeKey = '';
  var connectDrag = null;
  var edgeDrag = null;
  var edgeDragFrame = 0;
  var edgeUiZoom = 0;
  var suppressEdgeDblclick = false;
  var lastEdgeInteractionAt = 0;
  var lastPointClick = null;
  var lastLineClick = null;
  var edgeHintShown = false;
  var historyUndo = [];
  var historyRedo = [];
  var textHistoryTimer = 0;
  var textBurstActive = false;
  var suppressNextInputHistory = false;
  var lastCommittedSnapshot = null;
  var trackedNodes = [];
  var lastDroppedLinksSignature = '';
  var editorComposing = false;
  var lastReport = null;
  var renderError = '';
  var renderTimer = 0;
  var saveTimer = 0;
  var currentPopover = null;
  var currentTrigger = null;
  var diagDismissed = false;
  var metrics = { lineHeight: 22, padTop: 16 };
  var zoom = 1;
  var pan = { x: 0, y: 0 };
  var fitMode = true;

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */

  function boot() {
    cacheElements();
    loadState();
    buildThemeCards();
    buildExampleList();
    buildInsertList();
    bindEvents();
    applyUiState();

    el.editor.value = state.source;
    trackedNodes = extractDefinedNodes(state.source).filter(function (n) { return !n.incomplete && n.key; });
    refreshEditor();
    lastCommittedSnapshot = captureSnapshot();
    syncHistoryButtons();

    stage = document.createElement('div');
    stage.id = 'flowchart-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.style.cssText = 'position:fixed;left:-30000px;top:0;width:1400px;height:1000px;opacity:0;pointer-events:none;overflow:hidden;';
    document.body.appendChild(stage);

    renderNow({ animate: false });
    requestAnimationFrame(function () {
      measureEditor();
      refreshEditor();
      fitToView();
    });

    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () {
        if (fitMode) requestAnimationFrame(fitToView);
      });
      observer.observe(el.viewport);
    }

    window.addEventListener('pagehide', function () {
      clearTimeout(saveTimer);
      persist();
    });
  }

  function cacheElements() {
    var ids = [
      'docTitle', 'saveState', 'examplesBtn', 'syntaxBtn', 'styleBtn', 'exportBtn',
      'editorBody', 'gutter', 'highlight', 'editor', 'activeLine',
      'diagnostics', 'diagCount', 'diagList', 'diagDismiss',
      'workspace', 'splitter',
      'themeLabel', 'staleBadge', 'gridBtn', 'frameBtn',
      'zoomOut', 'zoomReset', 'zoomIn', 'fitBtn', 'undoBtn', 'redoBtn', 'layoutResetBtn',
      'sheet', 'viewport', 'diagram', 'sheetEmpty', 'emptyTitle', 'emptyBody', 'emptyExampleBtn',
      'tbTitle', 'tbNodes', 'tbLinks', 'tbScale', 'tbDate',
      'statNodes', 'statLinks', 'statIssues', 'statRender', 'statCursor',
      'examplesPop', 'exampleList', 'stylePop', 'themeGrid', 'fontSelect',
      'fontSizeRange', 'fontSizeOut', 'lineWidthRange', 'lineWidthOut',
      'lineLengthRange', 'lineLengthOut', 'textMarginRange', 'textMarginOut',
      'arrowSelect', 'yesInput', 'noInput', 'animateToggle', 'jumpsToggle', 'resetStyleBtn',
      'insertPop', 'insertList', 'insertBtn', 'openBtn', 'downloadSourceBtn',
      'exportDialog', 'formatSeg', 'scaleField', 'scaleSeg', 'bgSeg',
      'padRange', 'padOut', 'keepLinks', 'linksCheck', 'formatNote',
      'exportSize', 'exportNote', 'copyBtn', 'downloadBtn',
      'syntaxDialog', 'edgeToolbar', 'edgeFromPort', 'edgeToPort',
      'edgeSimplifyBtn', 'edgeAutoBtn', 'edgeDeleteBtn', 'nodeToolbar',
      'distributeHBtn', 'distributeVBtn', 'toastStack', 'fileInput'
    ];

    ids.forEach(function (id) {
      el[id] = document.getElementById(id);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                             */
  /* ---------------------------------------------------------------------- */

  function loadState() {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    } catch {
      saved = null;
    }

    if (!saved || typeof saved.source !== 'string') {
      state.source = EXAMPLES[0].source;
      state.title = EXAMPLES[0].name;
      return;
    }

    state.source = saved.source;
    state.title = typeof saved.title === 'string' && saved.title.trim() ? saved.title : '未命名流程图';

    if (saved.theme && THEMES[saved.theme]) state.theme = saved.theme;

    var style = saved.style || {};
    var numberKeys = { fontSize: [10, 24], lineWidth: [1, 6], lineLength: [24, 90], textMargin: [4, 24] };
    Object.keys(numberKeys).forEach(function (key) {
      var value = Number(style[key]);
      if (isFinite(value)) state.style[key] = clamp(Math.round(value), numberKeys[key][0], numberKeys[key][1]);
    });
    if (style.font && FONTS[style.font]) state.style.font = style.font;
    if (['classic', 'block', 'classic-wide-long', 'oval'].indexOf(style.arrow) > -1) {
      state.style.arrow = style.arrow;
    }
    if (typeof style.animate === 'boolean') state.style.animate = style.animate;
    if (typeof style.jumps === 'boolean') state.style.jumps = style.jumps;
    ['yes', 'no'].forEach(function (key) {
      if (typeof style[key] === 'string') state.style[key] = style[key].slice(0, 14);
    });
    if (saved.version !== 2) {
      if (state.style.yes === 'yes') state.style.yes = '是';
      if (state.style.no === 'no') state.style.no = '否';
    }

    if (typeof saved.grid === 'boolean') state.grid = saved.grid;
    if (typeof saved.frame === 'boolean') state.frame = saved.frame;
    if (isFinite(Number(saved.editorWidth))) state.editorWidth = clamp(Number(saved.editorWidth), 26, 68);
    if (saved.mobilePane === 'sheet' || saved.mobilePane === 'source') state.mobilePane = saved.mobilePane;

    var exp = saved.export || {};
    if (['svg', 'png', 'jpeg'].indexOf(exp.format) > -1) state.export.format = exp.format;
    if ([1, 2, 3].indexOf(Number(exp.scale)) > -1) state.export.scale = Number(exp.scale);
    if (['sheet', 'transparent', 'white'].indexOf(exp.bg) > -1) state.export.bg = exp.bg;
    if (isFinite(Number(exp.pad))) state.export.pad = clamp(Number(exp.pad), 0, 96);
    if (typeof exp.links === 'boolean') state.export.links = exp.links;

    if (saved.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)) {
      state.layout = sanitizeLayout(saved.layout);
    }

    if (Array.isArray(saved.edges)) {
      state.edges = sanitizeEdges(saved.edges);
    }

    if (Array.isArray(saved.hiddenEdges)) {
      state.hiddenEdges = sanitizeHiddenEdges(saved.hiddenEdges);
    }
  }

  function sanitizeLayout(raw) {
    var layout = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return layout;
    Object.keys(raw).slice(0, 500).forEach(function (key) {
      var point = raw[key];
      if (!point || typeof point !== 'object') return;
      var x = Number(point.x);
      var y = Number(point.y);
      if (!isFinite(x) || !isFinite(y)) return;
      layout[key] = { x: clamp(x, -20000, 20000), y: clamp(y, -20000, 20000) };
    });
    return layout;
  }

  function sanitizeEdges(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 300).map(sanitizeEdgeEntry).filter(Boolean);
  }

  function hiddenEdgeSignature(source, branch, target) {
    return String(source) + '\u0000' + String(branch) + '\u0000' + String(target);
  }

  function hiddenSignatureOfEdge(edge) {
    return hiddenEdgeSignature(edge.source.key, edge.branch || 'next', edge.target.key);
  }

  function hiddenSignatureOfEntry(entry) {
    return hiddenEdgeSignature(entry.source, entry.branch || 'next', entry.target);
  }

  function cloneHiddenEdges(list) {
    return (list || []).map(function (entry) {
      return { source: entry.source, branch: entry.branch, target: entry.target };
    });
  }

  function sanitizeHiddenEdges(raw) {
    if (!Array.isArray(raw)) return [];
    var list = [];
    var seen = Object.create(null);
    raw.slice(0, 300).forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;
      var source = typeof entry.source === 'string' ? entry.source : '';
      var branch = typeof entry.branch === 'string' ? entry.branch : '';
      var target = typeof entry.target === 'string' ? entry.target : '';
      if (!source || !EDGE_BRANCH_SET[branch] || !target) return;
      var sig = hiddenEdgeSignature(source, branch, target);
      if (seen[sig]) return;
      seen[sig] = true;
      list.push({ source: source, branch: branch, target: target });
    });
    return list;
  }

  function edgeSignaturesFromSource(source) {
    var signatures = Object.create(null);
    String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || /^(\/\/|#)/.test(trimmed)) return;
      if (trimmed.indexOf('=>') !== -1 || trimmed.indexOf('->') === -1) return;
      var steps = trimmed.split('->').map(parseFlowStepToken);
      for (var i = 0; i < steps.length - 1; i++) {
        if (!steps[i].key || !steps[i + 1].key) continue;
        signatures[hiddenEdgeSignature(steps[i].key, steps[i].branch, steps[i + 1].key)] = true;
      }
    });
    return signatures;
  }

  /* Keep hidden edges that still exist after a source edit. */
  function reconcileHiddenEdges(previousSource, nextSource) {
    if (!state.hiddenEdges.length || previousSource === nextSource) return;
    var before = edgeSignaturesFromSource(previousSource);
    var after = edgeSignaturesFromSource(nextSource);
    var kept = state.hiddenEdges.filter(function (entry) {
      var sig = hiddenSignatureOfEntry(entry);
      return Boolean(before[sig] && after[sig]);
    });
    if (kept.length !== state.hiddenEdges.length) {
      state.hiddenEdges = kept;
      syncLayoutButton();
    }
  }

  function parseFlowSource(raw) {
    var text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
    var lines = text.split('\n');
    var kept = [];
    var layout = {};
    var edges = [];
    var hiddenEdges = [];
    var hasMeta = false;
    var removedTrailingMeta = false;

    lines.forEach(function (line, index) {
      var match = FLOW_META_LINE_RE.exec(line);
      if (match) {
        try {
          var data = JSON.parse(match[1]);
          if (data && typeof data === 'object' && !Array.isArray(data) &&
              (data.layout != null || data.edges != null || data.hiddenEdges != null)) {
            if (data.layout && typeof data.layout === 'object' && !Array.isArray(data.layout)) {
              Object.assign(layout, sanitizeLayout(data.layout));
            }
            if (Array.isArray(data.edges)) {
              edges = sanitizeEdges(data.edges);
            }
            if (Array.isArray(data.hiddenEdges)) {
              hiddenEdges = sanitizeHiddenEdges(data.hiddenEdges);
            }
            hasMeta = true;
            if (index >= lines.length - 2) removedTrailingMeta = true;
            return;
          }
        } catch {
          /* Not plotter metadata; keep as a comment. */
        }
      }
      kept.push(line);
    });

    if (removedTrailingMeta) {
      while (kept.length > 0 && kept[kept.length - 1].trim() === '') {
        kept.pop();
      }
    }

    return {
      source: kept.join('\n'),
      layout: layout,
      edges: edges,
      hiddenEdges: hiddenEdges,
      hasMeta: hasMeta
    };
  }

  function serializeFlowSource(source, layout, edges, hiddenEdges) {
    var parsed = parseFlowSource(source);
    var cleanSource = parsed.source;
    var cleanLayout = sanitizeLayout(layout);
    var cleanEdges = sanitizeEdges(edges);
    var cleanHidden = sanitizeHiddenEdges(hiddenEdges);
    var hasLayout = Object.keys(cleanLayout).length > 0;
    var hasEdges = cleanEdges.length > 0;
    var hasHidden = cleanHidden.length > 0;

    if (!hasLayout && !hasEdges && !hasHidden) return cleanSource;

    var meta = {};
    if (hasLayout) meta.layout = cleanLayout;
    if (hasEdges) meta.edges = cleanEdges;
    if (hasHidden) meta.hiddenEdges = cleanHidden;

    var metaComment = '// @plotter ' + JSON.stringify(meta);
    var trimmed = cleanSource.replace(/\s+$/, '');
    if (!trimmed) return metaComment + '\n';
    return trimmed + '\n\n' + metaComment + '\n';
  }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        version: 2,
        title: state.title,
        source: el.editor.value,
        theme: state.theme,
        style: state.style,
        grid: state.grid,
        frame: state.frame,
        layout: state.layout,
        edges: state.edges,
        hiddenEdges: state.hiddenEdges,
        editorWidth: state.editorWidth,
        mobilePane: state.mobilePane,
        export: state.export
      }));
    } catch {
      /* Storage may be unavailable. */
    }
  }

  function markSaving() {
    el.saveState.classList.add('saving');
    el.saveState.querySelector('span').textContent = '保存中';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      persist();
      el.saveState.classList.remove('saving');
      el.saveState.querySelector('span').textContent = '已保存';
    }, 380);
  }

  /* ---------------------------------------------------------------------- */
  /* UI state                                                                */
  /* ---------------------------------------------------------------------- */

  function applyUiState() {
    el.docTitle.value = state.title;
    el.sheet.dataset.theme = state.theme;
    el.themeLabel.textContent = THEMES[state.theme].label;
    el.sheet.classList.toggle('no-grid', !state.grid);
    el.sheet.classList.toggle('no-frame', !state.frame);
    el.gridBtn.setAttribute('aria-pressed', String(state.grid));
    el.frameBtn.setAttribute('aria-pressed', String(state.frame));
    el.workspace.style.setProperty('--editor-w', state.editorWidth + '%');
    el.splitter.setAttribute('aria-valuenow', String(Math.round(state.editorWidth)));
    el.tbTitle.textContent = state.title;
    el.tbDate.textContent = today();
    document.body.dataset.pane = state.mobilePane || 'source';
    syncMobileSwitch();
    updateDocumentTitle();
    syncStyleControls();
    syncExportControls();
    syncLayoutButton();
  }

  function updateDocumentTitle() {
    document.title = state.title + ' — Plotter';
    el.tbTitle.textContent = state.title;
  }

  function today() {
    var date = new Date();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function syncMobileSwitch() {
    $$('.mobile-switch button').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.pane === state.mobilePane));
    });
  }

  function buildThemeCards() {
    Object.keys(THEMES).forEach(function (key) {
      var theme = THEMES[key];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-card';
      button.dataset.theme = key;
      button.setAttribute('aria-pressed', String(key === state.theme));
      button.innerHTML = '<span class="theme-swatch"></span><span class="theme-name"></span>';
      button.querySelector('.theme-name').textContent = theme.label;
      var swatch = button.querySelector('.theme-swatch');
      swatch.style.setProperty('--sw-bg', theme.swatch.bg);
      swatch.style.setProperty('--sw-ink', theme.swatch.ink);
      swatch.style.setProperty('--sw-fill', theme.swatch.fill);
      button.addEventListener('click', function () { setTheme(key); });
      el.themeGrid.appendChild(button);
    });
  }

  function buildExampleList() {
    EXAMPLES.forEach(function (example) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'example-item';
      button.innerHTML = '<span class="example-glyph">' + example.glyph + '</span>' +
        '<span class="example-text"><span class="example-name"></span><span class="example-desc"></span></span>';
      button.querySelector('.example-name').textContent = example.name;
      button.querySelector('.example-desc').textContent = example.desc;
      button.addEventListener('click', function () {
        loadExample(example);
        closePopovers();
      });
      el.exampleList.appendChild(button);
    });
  }

  function buildInsertList() {
    Object.keys(SNIPPETS).forEach(function (type) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'insert-item';
      button.innerHTML = (NODE_GLYPHS[type] || '') + '<span></span>';
      button.querySelector('span').textContent = NODE_LABELS[type] || type;
      button.title = type;
      button.addEventListener('click', function () {
        insertSnippet(type);
        closePopovers();
      });
      el.insertList.appendChild(button);
    });
  }

  function setTheme(key) {
    if (!THEMES[key]) return;
    state.theme = key;
    el.sheet.dataset.theme = key;
    el.themeLabel.textContent = THEMES[key].label;
    $$('.theme-card', el.themeGrid).forEach(function (card) {
      card.setAttribute('aria-pressed', String(card.dataset.theme === key));
    });
    scheduleRender(40);
    markSaving();
  }

  function syncStyleControls() {
    var style = state.style;
    setRange('fontSizeRange', 'fontSizeOut', style.fontSize);
    setRange('lineWidthRange', 'lineWidthOut', style.lineWidth);
    setRange('lineLengthRange', 'lineLengthOut', style.lineLength);
    setRange('textMarginRange', 'textMarginOut', style.textMargin);
    el.fontSelect.value = style.font;
    el.arrowSelect.value = style.arrow;
    el.yesInput.value = style.yes;
    el.noInput.value = style.no;
    el.animateToggle.checked = style.animate;
    el.jumpsToggle.checked = style.jumps !== false;
  }

  function setRange(inputId, outputId, value) {
    el[inputId].value = value;
    el[outputId].textContent = String(value);
  }

  /* ---------------------------------------------------------------------- */
  /* Editor                                                                  */
  /* ---------------------------------------------------------------------- */

  function measureEditor() {
    var styles = getComputedStyle(el.editor);
    var lineHeight = parseFloat(styles.lineHeight);
    var padTop = parseFloat(styles.paddingTop);
    metrics.lineHeight = isFinite(lineHeight) ? lineHeight : 22;
    metrics.padTop = isFinite(padTop) ? padTop : 16;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function tok(cls, text) {
    if (!text) return '';
    return '<span class="tok-' + cls + '">' + escapeHtml(text) + '</span>';
  }

  function highlightLine(line) {
    var trimmed = line.trim();
    if (!trimmed) return '';
    if (/^(\/\/|#)/.test(trimmed)) return tok('comment', line);

    var indent = line.slice(0, line.indexOf(trimmed));
    var body = trimmed;
    var out;

    if (body.indexOf('=>') > -1) out = highlightDefinition(body);
    else if (body.indexOf('->') > -1) out = highlightConnection(body);
    else if (body.indexOf('@>') > -1) out = highlightStyle(body);
    else out = tok('cont', body);

    return escapeHtml(indent) + out;
  }

  function highlightDefinition(body) {
    var arrow = body.indexOf('=>');
    var left = body.slice(0, arrow);
    var right = body.slice(arrow + 2);
    var out = '';

    var leftMatch = /^([^()]*)(\([^)]*\))?$/.exec(left);
    if (leftMatch) {
      out += tok('key', leftMatch[1]);
      if (leftMatch[2]) out += tok('param', leftMatch[2]);
    } else {
      out += tok('key', left);
    }
    out += tok('op', '=>');

    var colon = right.indexOf(':');
    var type = colon === -1 ? right : right.slice(0, colon);
    var tail = colon === -1 ? '' : right.slice(colon);
    out += tok('type', type);

    if (!tail) return out;

    if (tail.slice(0, 2) === ':>') {
      out += tok('op', ':>') + highlightLink(tail.slice(2));
      return out;
    }

    out += tok('punc', ':');
    var text = tail.slice(1);
    if (text.charAt(0) === ' ') {
      out += ' ';
      text = text.slice(1);
    }

    var link = '';
    var linkAt = text.indexOf(':>');
    if (linkAt > -1) {
      link = text.slice(linkAt);
      text = text.slice(0, linkAt);
    }

    var flowstate = '';
    var pipeAt = text.lastIndexOf('|');
    if (pipeAt > -1) {
      flowstate = text.slice(pipeAt);
      text = text.slice(0, pipeAt);
    }

    out += tok('text', text);
    if (flowstate) out += tok('state', flowstate);
    if (link) out += tok('op', ':>') + highlightLink(link.slice(2));

    return out;
  }

  function highlightLink(url) {
    var match = /^(.*?)(\[[^\]]*\])?$/.exec(url);
    if (!match) return tok('link', url);
    return tok('link', match[1]) + (match[2] ? tok('target', match[2]) : '');
  }

  function highlightConnection(body) {
    var parts = body.split('->');
    var out = '';
    parts.forEach(function (part, index) {
      if (index) out += tok('op', '->');
      out += highlightRef(part);
    });
    return out;
  }

  function highlightRef(part) {
    var match = /^([^()]*)(\([^)]*\))?$/.exec(part);
    if (!match) return tok('key', part);

    var out = tok('key', match[1]);
    if (!match[2]) return out;

    out += tok('punc', '(');
    var inner = match[2].slice(1, -1);
    inner.split(',').forEach(function (bit, index) {
      if (index) out += tok('punc', ',');
      var at = bit.indexOf('@');
      if (at > -1) {
        out += tok('branch', bit.slice(0, at)) + tok('annot', bit.slice(at));
      } else {
        out += tok('param', bit);
      }
    });
    out += tok('punc', ')');
    return out;
  }

  function highlightStyle(body) {
    var parts = body.split('@>');
    var out = '';
    parts.forEach(function (part, index) {
      if (index) out += tok('op', '@>');
      var open = part.indexOf('(');
      var close = part.lastIndexOf(')');
      if (open > -1 && close > open) {
        out += tok('key', part.slice(0, open));
        out += tok('punc', '(');
        out += escapeHtml(part.slice(open + 1, close)).replace(/("[^"]*")/g, '<span class="tok-str">$1</span>');
        out += tok('punc', ')');
      } else {
        out += tok('key', part);
      }
    });
    return out;
  }

  function refreshEditor() {
    var value = el.editor.value;
    var lines = value.split('\n');
    el.highlight.innerHTML = lines.map(highlightLine).join('\n') + '\n';
    renderGutter(lines.length);
    syncScroll();
    updateActiveLine();
  }

  function renderGutter(count) {
    var html = '';
    for (var i = 1; i <= count; i++) {
      html += '<div class="ln" data-line="' + i + '">' + i + '</div>';
    }
    el.gutter.innerHTML = html;
    el.gutter.scrollTop = el.editor.scrollTop;
    applyGutterMarks();
  }

  function applyGutterMarks() {
    var errorLines = Object.create(null);
    var warnLines = Object.create(null);

    if (lastReport) {
      lastReport.issues.forEach(function (issue) {
        if (issue.severity === 'error') errorLines[issue.line] = true;
        else warnLines[issue.line] = true;
      });
    }

    $$('.ln', el.gutter).forEach(function (node) {
      var line = Number(node.dataset.line);
      node.classList.toggle('error', Boolean(errorLines[line]));
      node.classList.toggle('warn', !errorLines[line] && Boolean(warnLines[line]));
    });
  }

  function syncScroll() {
    el.highlight.scrollTop = el.editor.scrollTop;
    el.highlight.scrollLeft = el.editor.scrollLeft;
    el.gutter.scrollTop = el.editor.scrollTop;
  }

  function updateActiveLine() {
    var position = el.editor.selectionStart || 0;
    var before = el.editor.value.slice(0, position);
    var line = before.split('\n').length;
    var top = metrics.padTop + (line - 1) * metrics.lineHeight - el.editor.scrollTop;

    el.activeLine.style.transform = 'translateY(' + top + 'px)';
    el.activeLine.style.opacity = (top < -metrics.lineHeight || top > el.editor.clientHeight) ? '0' : '1';

    var previous = el.gutter.querySelector('.ln.active');
    if (previous) previous.classList.remove('active');
    var current = el.gutter.children[line - 1];
    if (current) current.classList.add('active');

    var column = position - before.lastIndexOf('\n');
    el.statCursor.textContent = '行 ' + line + ', 列 ' + column;

    if (!textBurstActive && !editorComposing && lastCommittedSnapshot &&
        lastCommittedSnapshot.source === el.editor.value) {
      lastCommittedSnapshot.selectionStart = el.editor.selectionStart || 0;
      lastCommittedSnapshot.selectionEnd = el.editor.selectionEnd || 0;
    }
  }

  function onEditorInput() {
    if (editorComposing) {
      state.source = el.editor.value;
      refreshEditor();
      return;
    }

    var previousSnap = lastCommittedSnapshot || captureSnapshot();
    var previousSource = state.source;
    reconcileHiddenEdges(previousSource, el.editor.value);

    if (el.editor.value.indexOf('@plotter') !== -1) {
      var parsed = parseFlowSource(el.editor.value);
      if (parsed.hasMeta) {
        pushHistorySnapshot(previousSnap);
        state.layout = parsed.layout;
        state.edges = parsed.edges;
        state.hiddenEdges = parsed.hiddenEdges;
        el.editor.value = parsed.source;
        syncLayoutButton();
        suppressNextInputHistory = true;
      }
    }

    reconcileNodeRenames(el.editor.value);
    recordEditorHistoryOnInput(previousSnap, el.editor.value);

    state.source = el.editor.value;
    diagDismissed = false;
    refreshEditor();
    scheduleRender(180);
    markSaving();
  }

  function insertAtCursor(text) {
    var snapshot = captureManualState();
    var start = el.editor.selectionStart;
    var end = el.editor.selectionEnd;
    el.editor.setRangeText(text, start, end, 'end');
    el.editor.focus();
    if (el.editor.value !== snapshot.source) {
      pushHistorySnapshot(snapshot);
      suppressNextInputHistory = true;
    }
    onEditorInput();
  }

  function toggleComment() {
    var snapshot = captureManualState();
    var value = el.editor.value;
    var start = el.editor.selectionStart;
    var end = el.editor.selectionEnd;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;

    var block = value.slice(lineStart, lineEnd);
    var lines = block.split('\n');
    var allCommented = lines.every(function (line) {
      return !line.trim() || /^\s*\/\//.test(line);
    });

    var next = lines.map(function (line) {
      if (!line.trim()) return line;
      if (allCommented) return line.replace(/^(\s*)\/\/ ?/, '$1');
      return line.replace(/^(\s*)/, '$1// ');
    }).join('\n');

    el.editor.setRangeText(next, lineStart, lineEnd, 'select');
    if (el.editor.value !== snapshot.source) {
      pushHistorySnapshot(snapshot);
      suppressNextInputHistory = true;
    }
    onEditorInput();
  }

  function goToLine(lineNumber) {
    var lines = el.editor.value.split('\n');
    var index = clamp(lineNumber - 1, 0, lines.length - 1);
    var start = lines.slice(0, index).join('\n').length + (index > 0 ? 1 : 0);
    var end = start + lines[index].length;

    el.editor.focus();
    el.editor.setSelectionRange(start, end);
    el.editor.scrollTop = Math.max(0, index * metrics.lineHeight - el.editor.clientHeight / 2);
    refreshEditor();
  }

  function uniqueKey(base) {
    var key = base;
    var counter = 1;
    var escaped;
    do {
      escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var pattern = new RegExp('(^|\\n)\\s*' + escaped + '\\s*(?:\\(|=>)');
      if (!pattern.test(el.editor.value)) return key;
      counter++;
      key = base + counter;
    } while (counter < 99);
    return base + Date.now();
  }

  function insertSnippet(type) {
    var template = SNIPPETS[type];
    if (!template) return;

    var base = template.slice(0, template.indexOf('=>'));
    var key = uniqueKey(base);
    var text = key + template.slice(base.length);
    var before = el.editor.value.slice(0, el.editor.selectionStart);
    var needsNewline = before.length > 0 && !/\n$/.test(before);

    insertAtCursor((needsNewline ? '\n' : '') + text + '\n');
    toast('已插入节点：' + (NODE_LABELS[type] || type));
  }

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                               */
  /* ---------------------------------------------------------------------- */

  function scheduleRender(delay) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      renderNow({ animate: true });
    }, typeof delay === 'number' ? delay : 180);
  }

  function buildFlowOptions() {
    var theme = THEMES[state.theme] || THEMES.drafting;
    var style = state.style;
    var symbols = {};
    var flowstate = {};

    Object.keys(theme.flow.symbols || {}).forEach(function (key) {
      symbols[key] = Object.assign({}, theme.flow.symbols[key]);
    });
    Object.keys(theme.flow.flowstate || {}).forEach(function (key) {
      flowstate[key] = Object.assign({}, theme.flow.flowstate[key]);
    });

    return {
      x: 0,
      y: 0,
      'line-width': style.lineWidth,
      'line-length': style.lineLength,
      'text-margin': style.textMargin,
      'font-size': style.fontSize,
      'font-family': (FONTS[style.font] || FONTS.sans).stack,
      'font-color': theme.flow['font-color'],
      'line-color': theme.flow['line-color'],
      'element-color': theme.flow['element-color'],
      fill: theme.flow.fill,
      'yes-text': style.yes || 'yes',
      'no-text': style.no || 'no',
      /* Arrowheads are drawn by Plotter; 'arrow-end' stays off. */
      'arrow-end': 'none',
      scale: 1,
      symbols: symbols,
      flowstate: flowstate
    };
  }

  function renderNow(options) {
    options = options || {};
    abortNodeDrag();
    abortEdgeDrag(false);
    finishMarquee(true);
    var report = FlowLint.validate(el.editor.value);
    lastReport = report;
    renderError = '';
    updateDiagnostics(report);

    if (report.errors > 0) {
      markStale(true);
      updateStats(report, null);
      updateEmpty(report);
      return;
    }

    if (report.nodes === 0) {
      clearEdgeSelection();
      clearNodeSelection();
      currentEdges = [];
      hiddenEdgeCount = 0;
      tidyLayout = null;
      lastDroppedLinksSignature = '';
      lastSvg = null;
      lastChart = null;
      el.diagram.replaceChildren();
      markStale(false);
      if (el.exportBtn) el.exportBtn.disabled = true;
      updateStats(report, null);
      updateEmpty(report);
      el.statRender.textContent = '就绪';
      zoom = 1;
      pan = { x: 0, y: 0 };
      fitMode = true;
      applyTransform();
      return;
    }

    var started = (window.performance && performance.now) ? performance.now() : Date.now();
    var previousSvg = lastSvg;
    var previousChart = lastChart;
    var placed = false;

    try {
      var chart = flowchart.parse(FlowLint.stripComments(el.editor.value));
      stage.innerHTML = '';
      chart.drawSVG(stage, buildFlowOptions());

      var svg = stage.querySelector('svg');
      if (!svg) throw new Error('flowchart.js 没有生成绘图。');

      lastSvg = svg;
      lastChart = chart;

      var tidyMoved = applyTidyLayout(chart);
      var layoutMoved = applySavedLayout(chart);
      redrawConnections(chart, true);
      tagLayoutTargets(chart, svg);

      var drawnKeySet = {};
      Array.prototype.slice.call(svg.querySelectorAll('[data-node]')).forEach(function (node) {
        var key = node.getAttribute('data-node');
        if (key) drawnKeySet[key] = true;
      });
      var drawnKeys = Object.keys(drawnKeySet);
      var definedKeys = Object.keys(chart.symbols || {});
      var missingNodes = definedKeys.filter(function (key) { return !drawnKeySet[key]; });
      var hasLabels = currentEdges.some(function (edge) { return Boolean(edge.label); });

      if (tidyMoved || layoutMoved || hasEdgeOverrides() || hasLabels || hiddenEdgeCount > 0) recomputeBounds(svg, chart);
      drawNodeSelectionOverlay();
      updateNodeToolbar();

      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '流程图绘图');
      el.diagram.replaceChildren(svg);
      placed = true;

      var droppedLinks = Math.max(0, (Number(report.links) || 0) - currentEdges.length - hiddenEdgeCount);
      if (droppedLinks > 0) {
        var signature = String(report.links) + ':' + String(currentEdges.length) + ':' + String(hiddenEdgeCount) + ':' + missingNodes.join(',');
        var message = '有 ' + droppedLinks + ' 条连线未被绘制。';
        var hint = 'flowchart.js 的普通节点只能有一个 next 出边；同一节点有多条出边时，后写的边会覆盖先写的边。';
        if (missingNodes.length) {
          hint += ' 未绘制节点：' + missingNodes.slice(0, 4).join('、') + (missingNodes.length > 4 ? '…' : '') + '。';
        }

        report.issues.push({
          line: 1,
          severity: 'error',
          message: message,
          hint: hint
        });
        report.errors = (report.errors || 0) + 1;
        updateDiagnostics(report);

        if (signature !== lastDroppedLinksSignature) {
          lastDroppedLinksSignature = signature;
          toast(message + ' 请检查同一节点是否有多条出边。', null, null, 'error');
        }
      } else {
        lastDroppedLinksSignature = '';
      }

      var rendered = { nodes: drawnKeys.length, links: currentEdges.length };
      markStale(droppedLinks > 0, droppedLinks > 0 ? '部分节点或连线未被绘制' : '');
      updateStats(report, rendered);
      updateEmpty(report);

      if (options.animate !== false && state.style.animate && !prefersReducedMotion()) {
        animatePlot(svg);
      }

      var elapsed = Math.max(1, Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - started));
      el.statRender.textContent = '绘制 ' + elapsed + ' ms';

      if (fitMode) requestAnimationFrame(fitToView);
      else applyTransform();
    } catch (err) {
      if (!placed) {
        lastSvg = previousSvg;
        lastChart = previousChart;
      }
      renderError = err && err.message ? String(err.message) : String(err);
      markStale(true);
      updateDiagnostics(report);
      updateStats(report, null);
      updateEmpty(report);
      el.statRender.textContent = '绘制失败';
    }
  }

  function animatePlot(svg) {
    var paths = $$('path', svg);
    paths.forEach(function (path, index) {
      var length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        return;
      }
      if (!length || !isFinite(length)) return;

      var delay = Math.min(index * 16, 300);
      path.style.strokeDasharray = length + ' ' + length;
      path.style.strokeDashoffset = String(length);
      path.style.transition = 'stroke-dashoffset 480ms cubic-bezier(.22,.61,.36,1)';
      path.style.transitionDelay = delay + 'ms';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          path.style.strokeDashoffset = '0';
        });
      });

      setTimeout(function () {
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        path.style.transition = '';
        path.style.transitionDelay = '';
      }, 900 + delay);
    });

    svg.style.animation = 'plot-fade 260ms ease-out both';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function markStale(stale, reason) {
    el.sheet.dataset.stale = stale ? 'true' : 'false';
    el.staleBadge.hidden = !stale;
    el.staleBadge.title = stale ? (reason || '源码或图纸需要更新') : '';
    if (el.exportBtn) el.exportBtn.disabled = stale;
    if (stale) {
      hideEdgeToolbar();
      hideNodeToolbar();
    }
  }

  function updateStats(report, rendered) {
    var nodes = rendered ? rendered.nodes : report.nodes;
    var links = rendered ? rendered.links : report.links;

    el.statNodes.textContent = String(nodes);
    el.statLinks.textContent = String(links);
    el.tbNodes.textContent = String(nodes);
    el.tbLinks.textContent = String(links);

    var dot = el.statIssues.querySelector('.dot');
    var label = el.statIssues.querySelector('span');
    dot.className = 'dot' + (report.errors ? ' err' : report.warnings ? ' warn' : '');
    label.textContent = report.errors
      ? report.errors + ' 个错误'
      : report.warnings
        ? report.warnings + ' 个警告'
        : '无问题';
  }

  function updateEmpty(report) {
    var hasDrawing = Boolean(lastSvg);
    el.sheetEmpty.hidden = hasDrawing;
    if (hasDrawing) return;

    if (renderError) {
      el.emptyTitle.textContent = '绘制失败';
      el.emptyBody.textContent = 'flowchart.js 无法绘制这段源码，请检查编辑器下方的提示。';
    } else if (report && report.errors > 0) {
      el.emptyTitle.textContent = '暂时无法绘制';
      el.emptyBody.textContent = '修正源码面板中标记的错误，图纸会自动更新。';
    } else {
      el.emptyTitle.textContent = '还没有绘图';
      el.emptyBody.textContent = '在源码面板中编写流程，或打开一个示例了解语法。';
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Diagnostics                                                             */
  /* ---------------------------------------------------------------------- */

  function updateDiagnostics(report) {
    var issues = report.issues.slice();

    if (renderError) {
      issues.unshift({
        line: 1,
        severity: 'error',
        message: 'flowchart.js 无法绘制这段源码。',
        hint: renderError.slice(0, 180)
      });
    }

    var errorCount = issues.filter(function (issue) { return issue.severity === 'error'; }).length;
    var warningCount = issues.length - errorCount;

    applyGutterMarks();

    if (!issues.length || diagDismissed) {
      el.diagnostics.hidden = true;
      return;
    }

    el.diagnostics.hidden = false;
    el.diagCount.innerHTML = '';
    var dot = document.createElement('i');
    dot.className = 'dot' + (errorCount ? ' err' : ' warn');
    el.diagCount.appendChild(dot);
    var label = document.createElement('span');
    label.textContent = errorCount
      ? errorCount + ' 个错误' + (warningCount ? ' · ' + warningCount + ' 个警告' : '')
      : warningCount + ' 个警告';
    el.diagCount.appendChild(label);

    el.diagList.innerHTML = '';
    issues.slice(0, 24).forEach(function (issue) {
      var item = document.createElement('li');
      item.className = 'diag-item';

      var button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', function () { goToLine(issue.line); });

      var line = document.createElement('span');
      line.className = 'diag-line';
      line.textContent = String(issue.line);

      var message = document.createElement('span');
      message.className = 'diag-msg';
      var strong = document.createElement('strong');
      strong.textContent = issue.message;
      message.appendChild(strong);
      if (issue.hint) {
        var hint = document.createElement('span');
        hint.className = 'diag-hint';
        hint.textContent = issue.hint;
        message.appendChild(hint);
      }

      button.appendChild(line);
      button.appendChild(message);
      item.appendChild(button);
      el.diagList.appendChild(item);
    });

    if (issues.length > 24) {
      var more = document.createElement('li');
      more.className = 'diag-item';
      more.innerHTML = '<button type="button"><span class="diag-line">…</span><span class="diag-msg">还有 ' + (issues.length - 24) + ' 条提示。</span></button>';
      el.diagList.appendChild(more);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Zoom and pan                                                            */
  /* ---------------------------------------------------------------------- */

  function readViewBox(svg) {
    var raw = svg.getAttribute('viewBox');
    if (raw) {
      var parts = raw.split(/[\s,]+/).map(parseFloat);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
    }
    var width = parseFloat(svg.getAttribute('width')) || svg.clientWidth || 400;
    var height = parseFloat(svg.getAttribute('height')) || svg.clientHeight || 300;
    return { x: 0, y: 0, w: width, h: height };
  }

  function applyTransform() {
    el.diagram.style.transform = 'translate(calc(-50% + ' + pan.x + 'px), calc(-50% + ' + pan.y + 'px)) scale(' + zoom + ')';
    var label = Math.round(zoom * 100) + '%';
    el.zoomReset.textContent = label;
    el.tbScale.textContent = label;
    updateEdgeUiScale();
    positionEdgeToolbar();
    positionNodeToolbar();
  }

  function fitToView() {
    if (!lastSvg) {
      zoom = 1;
      pan = { x: 0, y: 0 };
      fitMode = true;
      applyTransform();
      return;
    }

    var box = readViewBox(lastSvg);
    var rect = el.viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var scale = Math.min((rect.width - 64) / box.w, (rect.height - 64) / box.h, 1.8);
    zoom = clamp(scale, 0.08, 4);
    pan = { x: 0, y: 0 };
    fitMode = true;
    applyTransform();
  }

  function zoomAt(clientX, clientY, factor) {
    var rect = el.viewport.getBoundingClientRect();
    var originX = clientX - rect.left - rect.width / 2;
    var originY = clientY - rect.top - rect.height / 2;
    var next = clamp(zoom * factor, 0.08, 4);
    var ratio = next / zoom;

    pan.x = originX - (originX - pan.x) * ratio;
    pan.y = originY - (originY - pan.y) * ratio;
    zoom = next;
    fitMode = false;
    applyTransform();
  }

  function zoomFromCenter(factor) {
    var rect = el.viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  /* ---------------------------------------------------------------------- */
  /* Manual layout                                                           */
  /* ---------------------------------------------------------------------- */

  function hasManualLayout() {
    return Object.keys(state.layout).length > 0;
  }

  function syncLayoutButton() {
    if (el.layoutResetBtn) {
      el.layoutResetBtn.disabled = !hasManualLayout() && !hasEdgeOverrides() && !state.hiddenEdges.length;
    }
  }

  function cloneLayoutSnapshot(source) {
    var copy = {};
    Object.keys(source || {}).forEach(function (key) {
      copy[key] = { x: source[key].x, y: source[key].y };
    });
    return copy;
  }

  function cloneEdgesSnapshot(source) {
    return (source || []).map(function (entry) {
      return {
        source: entry.source,
        branch: entry.branch,
        target: entry.target,
        from: entry.from,
        to: entry.to,
        manual: entry.manual === true,
        points: (entry.points || []).map(function (point) {
          return { x: point.x, y: point.y };
        })
      };
    });
  }

  function captureSnapshot() {
    var hasEditor = Boolean(el.editor);
    return {
      title: state.title,
      source: hasEditor ? el.editor.value : state.source,
      selectionStart: hasEditor && typeof el.editor.selectionStart === 'number' ? el.editor.selectionStart : 0,
      selectionEnd: hasEditor && typeof el.editor.selectionEnd === 'number' ? el.editor.selectionEnd : 0,
      layout: cloneLayoutSnapshot(state.layout),
      edges: cloneEdgesSnapshot(state.edges),
      hiddenEdges: cloneHiddenEdges(state.hiddenEdges)
    };
  }

  function commitPendingTextHistory() {
    if (textHistoryTimer) {
      clearTimeout(textHistoryTimer);
      textHistoryTimer = 0;
    }
    textBurstActive = false;
  }

  function isSameHistorySnapshot(a, b) {
    if (!a || !b) return false;
    if (a.source !== b.source || a.title !== b.title) return false;
    if (JSON.stringify(a.layout) !== JSON.stringify(b.layout)) return false;
    if (JSON.stringify(a.edges) !== JSON.stringify(b.edges)) return false;
    if (JSON.stringify(a.hiddenEdges) !== JSON.stringify(b.hiddenEdges)) return false;
    return true;
  }

  function syncHistoryButtons() {
    if (el.undoBtn) {
      el.undoBtn.disabled = historyUndo.length === 0;
      el.undoBtn.title = historyUndo.length
        ? '撤销 (Ctrl+Z) · 可回退 ' + historyUndo.length + ' 步'
        : '撤销 (Ctrl+Z)';
    }
    if (el.redoBtn) {
      el.redoBtn.disabled = historyRedo.length === 0;
      el.redoBtn.title = historyRedo.length
        ? '重做 (Ctrl+Y) · 可重做 ' + historyRedo.length + ' 步'
        : '重做 (Ctrl+Y)';
    }
  }

  function captureManualState() {
    commitPendingTextHistory();
    return captureSnapshot();
  }

  function pushHistorySnapshot(snapshot) {
    if (!snapshot) return;
    commitPendingTextHistory();
    var normalized = {
      title: typeof snapshot.title === 'string' ? snapshot.title : state.title,
      source: typeof snapshot.source === 'string' ? snapshot.source : (el.editor ? el.editor.value : state.source),
      selectionStart: typeof snapshot.selectionStart === 'number' ? snapshot.selectionStart : 0,
      selectionEnd: typeof snapshot.selectionEnd === 'number' ? snapshot.selectionEnd : 0,
      layout: cloneLayoutSnapshot(snapshot.layout),
      edges: cloneEdgesSnapshot(snapshot.edges),
      hiddenEdges: cloneHiddenEdges(snapshot.hiddenEdges)
    };
    var top = historyUndo.length ? historyUndo[historyUndo.length - 1] : null;
    if (!top || !isSameHistorySnapshot(top, normalized)) {
      historyUndo.push(normalized);
      if (historyUndo.length > HISTORY_LIMIT) historyUndo.shift();
    }
    historyRedo = [];
    lastCommittedSnapshot = captureSnapshot();
    syncHistoryButtons();
  }

  function recordEditorHistoryOnInput(previousSnap, currentText) {
    if (suppressNextInputHistory) {
      suppressNextInputHistory = false;
      commitPendingTextHistory();
      lastCommittedSnapshot = captureSnapshot();
      syncHistoryButtons();
      return;
    }

    if (!previousSnap || previousSnap.source === currentText) return;

    var prevLen = previousSnap.source.length;
    var nextLen = currentText.length;
    var deltaLen = Math.abs(nextLen - prevLen);
    var prevLines = previousSnap.source.split('\n').length;
    var nextLines = currentText.split('\n').length;
    var boundaryEdit = deltaLen > 12 || prevLines !== nextLines;

    if (!textBurstActive || boundaryEdit) {
      pushHistorySnapshot(previousSnap);
      if (!boundaryEdit) {
        textBurstActive = true;
      }
    }

    if (textBurstActive) {
      clearTimeout(textHistoryTimer);
      textHistoryTimer = setTimeout(commitPendingTextHistory, TEXT_HISTORY_COALESCE_MS);
    }

    lastCommittedSnapshot = captureSnapshot();
    syncHistoryButtons();
  }

  function extractDefinedNodes(source) {
    var lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
    var list = [];
    var seen = Object.create(null);
    var ord = 0;

    lines.forEach(function (raw, index) {
      var line = raw.trim();
      if (!line || /^(\/\/|#)/.test(line)) return;
      var arrow = line.indexOf('=>');
      if (arrow === -1) return;

      var left = line.slice(0, arrow).trim();
      var right = line.slice(arrow + 2).trim();
      var key = left.replace(/\([^)]*\)\s*$/, '').trim();
      var colon = right.indexOf(':');
      var type = (colon === -1 ? right : right.slice(0, colon)).trim();
      if (!type) return;

      var tail = colon === -1 ? '' : right.slice(colon).replace(/^:\s?/, '');
      var linkAt = tail.indexOf(':>');
      if (linkAt > -1) tail = tail.slice(0, linkAt);
      var pipeAt = tail.lastIndexOf('|');
      if (pipeAt > -1) tail = tail.slice(0, pipeAt);

      if (!key || /\s/.test(key)) {
        list.push({
          key: '',
          incomplete: true,
          type: type,
          line: index + 1,
          text: tail.trim(),
          ord: ord++
        });
        return;
      }

      if (seen[key]) return;
      seen[key] = true;
      list.push({
        key: key,
        incomplete: false,
        type: type,
        line: index + 1,
        text: tail.trim(),
        ord: ord++
      });
    });

    return list;
  }

  function migrateRenamedNodeKey(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) return false;
    var migrated = false;

    if (state.layout[oldKey] && !state.layout[newKey]) {
      state.layout[newKey] = state.layout[oldKey];
      delete state.layout[oldKey];
      migrated = true;
    }

    state.edges.forEach(function (entry) {
      if (!entry) return;
      if (entry.source === oldKey) {
        entry.source = newKey;
        migrated = true;
      }
      if (entry.target === oldKey) {
        entry.target = newKey;
        migrated = true;
      }
    });

    var selIdx = selectedNodeKeys.indexOf(oldKey);
    if (selIdx !== -1) {
      if (selectedNodeKeys.indexOf(newKey) === -1) selectedNodeKeys[selIdx] = newKey;
      else selectedNodeKeys.splice(selIdx, 1);
    }

    if (selectedEdgeKey && selectedEdgeKey.indexOf(oldKey + '\u0000') === 0) {
      selectedEdgeKey = newKey + selectedEdgeKey.slice(oldKey.length);
    }

    return migrated;
  }

  function reconcileNodeRenames(source) {
    var parsed = extractDefinedNodes(source);
    var currentValid = parsed.filter(function (n) { return !n.incomplete && n.key; });
    var incompleteLines = Object.create(null);
    parsed.forEach(function (n) {
      if (n.incomplete) incompleteLines[n.line] = n;
    });

    if (!trackedNodes.length) {
      trackedNodes = currentValid;
      return false;
    }

    var currentKeySet = Object.create(null);
    currentValid.forEach(function (n) { currentKeySet[n.key] = n; });

    var prevKeySet = Object.create(null);
    trackedNodes.forEach(function (n) { prevKeySet[n.key] = n; });

    var removed = trackedNodes.filter(function (n) { return !currentKeySet[n.key]; });
    var added = currentValid.filter(function (n) { return !prevKeySet[n.key]; });

    var usedRemoved = Object.create(null);
    var usedAdded = Object.create(null);
    var migrated = false;

    function pairUp(predicate) {
      removed.forEach(function (oldNode, rIdx) {
        if (usedRemoved[rIdx]) return;
        for (var aIdx = 0; aIdx < added.length; aIdx++) {
          if (usedAdded[aIdx]) continue;
          var newNode = added[aIdx];
          if (predicate(oldNode, newNode)) {
            usedRemoved[rIdx] = true;
            usedAdded[aIdx] = true;
            if (migrateRenamedNodeKey(oldNode.key, newNode.key)) migrated = true;
            break;
          }
        }
      });
    }

    if (removed.length && added.length) {
      pairUp(function (oldNode, newNode) {
        return oldNode.line === newNode.line && oldNode.type === newNode.type;
      });
      pairUp(function (oldNode, newNode) {
        return oldNode.ord === newNode.ord && oldNode.type === newNode.type && oldNode.text === newNode.text;
      });
      pairUp(function (oldNode, newNode) {
        return Boolean(oldNode.text) && oldNode.type === newNode.type && oldNode.text === newNode.text;
      });
    }

    var nextTracked = currentValid.slice();
    removed.forEach(function (oldNode, rIdx) {
      if (usedRemoved[rIdx]) return;
      var inc = incompleteLines[oldNode.line];
      if (inc && inc.type === oldNode.type) {
        nextTracked.push({
          key: oldNode.key,
          incomplete: false,
          type: oldNode.type,
          line: oldNode.line,
          text: inc.text || oldNode.text,
          ord: inc.ord
        });
      }
    });

    trackedNodes = nextTracked;
    if (migrated) syncLayoutButton();
    return migrated;
  }

  function applyManualState(snapshot) {
    if (!snapshot) return;
    commitPendingTextHistory();

    if (typeof snapshot.title === 'string' && snapshot.title !== state.title) {
      state.title = snapshot.title;
      if (el.docTitle) el.docTitle.value = snapshot.title;
      updateDocumentTitle();
    }

    state.layout = cloneLayoutSnapshot(snapshot.layout);
    state.edges = cloneEdgesSnapshot(snapshot.edges);
    state.hiddenEdges = cloneHiddenEdges(snapshot.hiddenEdges);

    if (typeof snapshot.source === 'string') {
      state.source = snapshot.source;
      if (el.editor && el.editor.value !== snapshot.source) {
        el.editor.value = snapshot.source;
      }
      if (el.editor && typeof snapshot.selectionStart === 'number' && typeof snapshot.selectionEnd === 'number') {
        try {
          el.editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
        } catch { /* ignore */ }
      }
      trackedNodes = extractDefinedNodes(snapshot.source).filter(function (n) { return !n.incomplete && n.key; });
      refreshEditor();
    }

    clearEdgeSelection();
    clearNodeSelection();
    persist();
    syncLayoutButton();
    renderNow({ animate: false });
    lastCommittedSnapshot = captureSnapshot();
    syncHistoryButtons();
  }

  function undoManual(fromButton) {
    if (edgeDrag) abortEdgeDrag(false);
    if (nodeDrag) abortNodeDrag();
    commitPendingTextHistory();

    if (!historyUndo.length) {
      toast('没有可撤销的操作。', null, null, 'warn');
      syncHistoryButtons();
      return;
    }

    var current = captureSnapshot();
    var previous = historyUndo.pop();
    var layoutOrEdgeChanged =
      JSON.stringify(current.layout) !== JSON.stringify(previous.layout) ||
      JSON.stringify(current.edges) !== JSON.stringify(previous.edges);

    historyRedo.push(current);
    if (historyRedo.length > HISTORY_LIMIT) historyRedo.shift();
    applyManualState(previous);

    if (fromButton !== false || layoutOrEdgeChanged || document.activeElement !== el.editor) {
      toast('已撤销 · 还可回退 ' + historyUndo.length + ' 步');
    }
  }

  function redoManual(fromButton) {
    if (edgeDrag) abortEdgeDrag(false);
    if (nodeDrag) abortNodeDrag();
    commitPendingTextHistory();

    if (!historyRedo.length) {
      toast('没有可重做的操作。', null, null, 'warn');
      syncHistoryButtons();
      return;
    }

    var current = captureSnapshot();
    var next = historyRedo.pop();
    var layoutOrEdgeChanged =
      JSON.stringify(current.layout) !== JSON.stringify(next.layout) ||
      JSON.stringify(current.edges) !== JSON.stringify(next.edges);

    historyUndo.push(current);
    if (historyUndo.length > HISTORY_LIMIT) historyUndo.shift();
    applyManualState(next);

    if (fromButton !== false || layoutOrEdgeChanged || document.activeElement !== el.editor) {
      toast('已重做 · 还可重做 ' + historyRedo.length + ' 步');
    }
  }

  function isTextEditingTarget(target) {
    if (!target) return false;
    var tag = target.tagName;
    return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || target.isContentEditable;
  }

  function isNonEditorInputTarget(target) {
    if (!target || target === el.editor) return false;
    return isTextEditingTarget(target);
  }

  function diagramSymbols(chart) {
    return (chart && chart.diagram && chart.diagram.symbols) || [];
  }

  function symbolAt(chart, point) {
    var symbols = diagramSymbols(chart);
    var hit = null;

    for (var i = 0; i < symbols.length; i++) {
      var box;
      try { box = symbols[i].group.getBBox(); } catch { continue; }
      if (!box) continue;
      if (point.x >= box.x && point.x <= box.x + box.width &&
          point.y >= box.y && point.y <= box.y + box.height) {
        hit = symbols[i];
      }
    }

    return hit;
  }

  function symbolNodes(symbol) {
    var nodes = [];
    var items = (symbol && symbol.group && symbol.group.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].node) nodes.push(items[i].node);
    }
    return nodes;
  }

  function nodeNodeSet(chart) {
    var keep = new Set();
    var symbols = diagramSymbols(chart);
    for (var i = 0; i < symbols.length; i++) {
      var nodes = symbolNodes(symbols[i]);
      for (var j = 0; j < nodes.length; j++) keep.add(nodes[j]);
    }
    return keep;
  }

  /* ---------------------------------------------------------------------- */
  /* Tidy layout                                                             */
  /* ---------------------------------------------------------------------- */

  function symbolBox(symbol) {
    if (!symbol || !symbol.group) return null;

    var box;
    try { box = symbol.group.getBBox(); } catch { return null; }
    if (!box) return null;

    var width = Number(box.width);
    var height = Number(box.height);
    if (!isFinite(box.x) || !isFinite(box.y) || !isFinite(width) || !isFinite(height)) return null;
    if (width < 1 || height < 1) return null;

    return {
      x: box.x,
      y: box.y,
      w: width,
      h: height,
      cx: box.x + width / 2,
      cy: box.y + height / 2,
      left: box.x,
      right: box.x + width,
      top: box.y,
      bottom: box.y + height
    };
  }

  function collectTidyGraph(chart) {
    var symbols = diagramSymbols(chart);
    var index = new Map();
    var order = [];

    symbols.forEach(function (symbol) {
      if (!symbol || !symbol.key || index.has(symbol.key)) return;
      index.set(symbol.key, symbol);
      order.push(symbol.key);
    });

    var neighbours = {};
    var edges = [];

    order.forEach(function (key) { neighbours[key] = []; });

    order.forEach(function (key) {
      edgeBranches(index.get(key)).forEach(function (branch) {
        var target = branch.target && branch.target.key;
        if (!target || !index.has(target)) return;
        neighbours[key].push(target);
        edges.push({ from: key, to: target, branch: branch.branch, direction: branch.direction || '' });
      });
    });

    return { index: index, order: order, neighbours: neighbours, edges: edges };
  }

  function findTidyBackEdges(graph) {
    var color = {};
    var back = {};

    function visit(key) {
      color[key] = 1;
      graph.neighbours[key].forEach(function (next) {
        if (color[next] === 1) {
          back[key + '\u0000' + next] = true;
          return;
        }
        if (color[next] === 2) return;
        visit(next);
      });
      color[key] = 2;
    }

    graph.order.forEach(function (key) {
      if (!color[key]) visit(key);
    });

    return back;
  }

  function assignTidyLayers(graph, back) {
    var layer = {};
    var pending = {};

    graph.order.forEach(function (key) {
      layer[key] = 0;
      pending[key] = 0;
    });

    graph.edges.forEach(function (edge) {
      if (back[edge.from + '\u0000' + edge.to]) return;
      pending[edge.to] += 1;
    });

    var queue = graph.order.filter(function (key) { return pending[key] === 0; });
    var cursor = 0;
    var guard = 0;

    while (cursor < queue.length && guard++ < 10000) {
      var key = queue[cursor++];
      graph.neighbours[key].forEach(function (next) {
        if (back[key + '\u0000' + next]) return;
        layer[next] = Math.max(layer[next], layer[key] + 1);
        pending[next] -= 1;
        if (pending[next] === 0) queue.push(next);
      });
    }

    return layer;
  }

  function orderTidyLayers(graph, layer, back) {
    var layerCount = 0;
    graph.order.forEach(function (key) {
      layerCount = Math.max(layerCount, (layer[key] || 0) + 1);
    });

    var rows = [];
    var i;
    for (i = 0; i < layerCount; i++) rows.push([]);
    graph.order.forEach(function (key) {
      rows[layer[key] || 0].push(key);
    });

    var predecessors = {};
    var successors = {};
    graph.order.forEach(function (key) {
      predecessors[key] = [];
      successors[key] = [];
    });
    graph.edges.forEach(function (edge) {
      if (back && back[edge.from + '\u0000' + edge.to]) return;
      if ((layer[edge.from] || 0) < (layer[edge.to] || 0)) {
        predecessors[edge.to].push(edge.from);
        successors[edge.from].push(edge.to);
      }
    });

    var bias = {};
    graph.order.forEach(function (key) { bias[key] = 0; });
    graph.edges.forEach(function (edge) {
      if (back && back[edge.from + '\u0000' + edge.to]) return;
      if (edge.direction === 'right') bias[edge.to] += 1;
      else if (edge.direction === 'left') bias[edge.to] -= 1;
      else if (edge.branch === 'no' && !edge.direction) bias[edge.to] += 0.6;
      else if (edge.branch === 'path3' && !edge.direction) bias[edge.to] -= 0.6;
      else if (edge.branch === 'path2' && !edge.direction) bias[edge.to] += 0.6;
    });
    Object.keys(bias).forEach(function (key) {
      bias[key] = Math.max(-1, Math.min(1, bias[key]));
    });

    var position = {};
    function sync() {
      rows.forEach(function (row) {
        row.forEach(function (key, index) { position[key] = index; });
      });
    }
    sync();

    for (var pass = 0; pass < 4; pass++) {
      for (var line = 1; line < rows.length; line++) {
        var slots = {};
        rows[line].forEach(function (key, index) { slots[key] = index; });

        rows[line].sort(function (first, second) {
          function downBarycenter(key) {
            var sum = 0;
            var count = 0;
            predecessors[key].forEach(function (prev) {
              if ((layer[prev] || 0) >= (layer[key] || 0)) return;
              if (position[prev] == null) return;
              sum += position[prev];
              count += 1;
            });
            return count ? (sum / count) + (bias[key] || 0) * 0.35 : slots[key] + (bias[key] || 0) * 0.35;
          }

          var delta = downBarycenter(first) - downBarycenter(second);
          if (Math.abs(delta) > 0.001) return delta;
          var side = (bias[first] || 0) - (bias[second] || 0);
          if (Math.abs(side) > 0.001) return side;
          return slots[first] - slots[second];
        });

        sync();
      }

      for (var upLine = rows.length - 2; upLine >= 0; upLine--) {
        var upSlots = {};
        rows[upLine].forEach(function (key, index) { upSlots[key] = index; });

        rows[upLine].sort(function (first, second) {
          function upBarycenter(key) {
            var sum = 0;
            var count = 0;
            successors[key].forEach(function (next) {
              if ((layer[next] || 0) <= (layer[key] || 0)) return;
              if (position[next] == null) return;
              sum += position[next];
              count += 1;
            });
            return count ? sum / count : upSlots[key];
          }

          var delta = upBarycenter(first) - upBarycenter(second);
          if (Math.abs(delta) > 0.001) return delta;
          return upSlots[first] - upSlots[second];
        });

        sync();
      }
    }

    return rows;
  }

  function tidyPositions(rows, sizes, graph, layer, back) {
    var lineLength = Number(state.style && state.style.lineLength) || 50;
    var hGap = Math.max(52, lineLength * 1.15);
    var vGap = Math.max(54, lineLength * 1.05);

    var totals = rows.map(function (row) {
      var total = 0;
      row.forEach(function (key, index) {
        total += sizes[key].w + (index ? hGap : 0);
      });
      return total;
    });

    var center = 0;
    totals.forEach(function (total) { center = Math.max(center, total / 2); });
    if (center < 240) center = 240;

    var incoming = {};
    var outgoing = {};
    if (graph && graph.order) {
      graph.order.forEach(function (key) {
        incoming[key] = [];
        outgoing[key] = [];
      });
      graph.edges.forEach(function (edge) {
        if (back && back[edge.from + '\u0000' + edge.to]) return;
        if ((layer[edge.from] || 0) < (layer[edge.to] || 0)) {
          incoming[edge.to].push(edge);
          outgoing[edge.from].push(edge);
        }
      });
    }

    var cxMap = {};

    function resolveRowCollisions(row) {
      if (row.length <= 1) return;
      for (var iter = 0; iter < 6; iter++) {
        var changed = false;
        for (var i = 1; i < row.length; i++) {
          var prev = row[i - 1];
          var curr = row[i];
          var minDist = (sizes[prev].w + sizes[curr].w) / 2 + hGap;
          var actual = cxMap[curr] - cxMap[prev];
          if (actual < minDist - 0.1) {
            var push = (minDist - actual) / 2;
            var prevFixed = Math.abs(cxMap[prev] - center) < 1;
            var currFixed = Math.abs(cxMap[curr] - center) < 1;
            if (prevFixed && !currFixed) {
              cxMap[curr] += minDist - actual;
            } else if (currFixed && !prevFixed) {
              cxMap[prev] -= minDist - actual;
            } else {
              cxMap[prev] -= push;
              cxMap[curr] += push;
            }
            changed = true;
          }
        }
        if (!changed) break;
      }
    }

    rows.forEach(function (row, rowIndex) {
      if (rowIndex === 0 || !graph) {
        var startX = center - totals[rowIndex] / 2;
        row.forEach(function (key) {
          var size = sizes[key];
          cxMap[key] = startX + size.w / 2;
          startX += size.w + hGap;
        });
        return;
      }

      row.forEach(function (key, slotIndex) {
        var preds = incoming[key] || [];
        if (!preds.length) {
          var fallbackLeft = center - totals[rowIndex] / 2;
          for (var s = 0; s < slotIndex; s++) fallbackLeft += sizes[row[s]].w + hGap;
          cxMap[key] = fallbackLeft + sizes[key].w / 2;
          return;
        }

        var sumCx = 0;
        var count = 0;
        preds.forEach(function (edge) {
          var parentCx = cxMap[edge.from];
          if (parentCx == null) return;
          var dirOffset = 0;
          var parentWidth = sizes[edge.from] ? sizes[edge.from].w : 120;
          var ownWidth = sizes[key] ? sizes[key].w : 120;
          var branchStep = (parentWidth + ownWidth) / 2 + hGap;

          if (edge.direction === 'right') {
            dirOffset = branchStep;
          } else if (edge.direction === 'left') {
            dirOffset = -branchStep;
          } else if (edge.branch === 'no' && (outgoing[edge.from] || []).length >= 2) {
            dirOffset = branchStep;
          } else if (edge.branch === 'path2' && !edge.direction) {
            dirOffset = branchStep;
          } else if (edge.branch === 'path3' && !edge.direction) {
            dirOffset = -branchStep;
          }

          sumCx += parentCx + dirOffset;
          count += 1;
        });

        cxMap[key] = count ? sumCx / count : center;
      });

      resolveRowCollisions(row);
    });

    for (var upIdx = rows.length - 1; upIdx >= 1; upIdx--) {
      var r = rows[upIdx];
      if (r.length === 1) {
        var singleKey = r[0];
        var inEdges = incoming[singleKey] || [];
        var trunkParent = null;
        inEdges.forEach(function (edge) {
          if (Math.abs((cxMap[edge.from] || 0) - center) < 8) trunkParent = edge.from;
        });
        if (trunkParent) {
          cxMap[singleKey] = cxMap[trunkParent];
        } else if (inEdges.length >= 2) {
          cxMap[singleKey] = center;
        }
      }
      resolveRowCollisions(r);
    }

    var targets = {};
    var y = 0;

    rows.forEach(function (row) {
      var tallest = 0;
      row.forEach(function (key) {
        tallest = Math.max(tallest, sizes[key].h);
      });

      row.forEach(function (key) {
        var size = sizes[key];
        var nodeCx = cxMap[key] != null ? cxMap[key] : center;
        var nodeY = y + (tallest - size.h) / 2;
        targets[key] = {
          x: Math.round((nodeCx - size.w / 2) * 10) / 10,
          y: Math.round(nodeY * 10) / 10
        };
      });

      y += tallest + vGap;
    });

    return targets;
  }

  function assignTidyPorts(graph, boxes, layer, back) {
    var outgoing = {};
    var ports = {};
    var toPorts = {};

    graph.order.forEach(function (key) { outgoing[key] = []; });
    graph.edges.forEach(function (edge) {
      if (outgoing[edge.from]) outgoing[edge.from].push(edge);
    });

    graph.order.forEach(function (fromKey) {
      var list = outgoing[fromKey] || [];
      if (!list.length) return;

      var usedSides = {};
      var sourceBox = boxes && boxes[fromKey];
      var fromLayer = layer ? layer[fromKey] : 0;

      list.forEach(function (edge) {
        var k = edgeKey(edge.from, edge.branch);
        var targetBox = boxes && boxes[edge.to];
        var toLayer = layer ? layer[edge.to] : 0;
        var isBack = back && back[edge.from + '\u0000' + edge.to];

        var preferred = '';
        if (EDGE_SIDE_SET[edge.direction]) {
          preferred = edge.direction;
        } else if (isBack || (targetBox && sourceBox && toLayer <= fromLayer)) {
          if (targetBox && sourceBox) {
            preferred = targetBox.cx < sourceBox.cx - 10 ? 'left' : 'right';
          } else {
            preferred = 'right';
          }
        } else if (targetBox && sourceBox) {
          var dx = targetBox.cx - sourceBox.cx;
          var dy = targetBox.cy - sourceBox.cy;
          if (Math.abs(dx) <= 16 && dy > 0) {
            preferred = 'bottom';
          } else if (list.length === 1) {
            preferred = Math.abs(dx) > Math.abs(dy) * 1.6 ? (dx > 0 ? 'right' : 'left') : 'bottom';
          } else if (edge.branch === 'yes' || edge.branch === 'path1' || edge.branch === 'next') {
            preferred = Math.abs(dx) <= Math.abs(dy) * 0.9 ? 'bottom' : (dx > 0 ? 'right' : 'left');
          } else if (edge.branch === 'no' || edge.branch === 'path2') {
            preferred = dx < -12 ? 'left' : 'right';
          } else if (edge.branch === 'path3') {
            preferred = dx > 12 ? 'right' : 'left';
          } else {
            preferred = dx > 20 ? 'right' : dx < -20 ? 'left' : 'bottom';
          }
        } else {
          preferred = edge.branch === 'no' || edge.branch === 'path2' ? 'right'
            : edge.branch === 'path3' ? 'left' : 'bottom';
        }

        if (usedSides[preferred] && list.length > 1) {
          var fallbacks = preferred === 'bottom' ? ['right', 'left', 'bottom']
            : preferred === 'right' ? ['bottom', 'left', 'right']
            : ['bottom', 'right', 'left'];
          for (var f = 0; f < fallbacks.length; f++) {
            if (!usedSides[fallbacks[f]]) {
              preferred = fallbacks[f];
              break;
            }
          }
        }

        usedSides[preferred] = true;
        ports[k] = preferred;

        if (targetBox && sourceBox) {
          if (isBack || toLayer < fromLayer) {
            toPorts[k] = preferred === 'left' ? 'left' : preferred === 'right' ? 'right' : (targetBox.cx <= sourceBox.cx ? 'left' : 'right');
          } else if (toLayer === fromLayer) {
            toPorts[k] = targetBox.cx >= sourceBox.cx ? 'left' : 'right';
          } else {
            toPorts[k] = 'top';
          }
        } else {
          toPorts[k] = 'top';
        }
      });
    });

    return { from: ports, to: toPorts };
  }

  function applyTidyLayout(chart) {
    tidyLayout = null;

    var graph = collectTidyGraph(chart);
    if (graph.order.length < 2 || !graph.edges.length) return false;

    var sizes = {};
    for (var i = 0; i < graph.order.length; i++) {
      var box = symbolBox(graph.index.get(graph.order[i]));
      if (!box) return false;
      sizes[graph.order[i]] = box;
    }

    var back = findTidyBackEdges(graph);
    var layer = assignTidyLayers(graph, back);
    var rows = orderTidyLayers(graph, layer, back);
    var targets = tidyPositions(rows, sizes, graph, layer, back);

    var moved = false;
    var updatedBoxes = {};
    graph.order.forEach(function (key) {
      var symbol = graph.index.get(key);
      var box = sizes[key];
      var target = targets[key];
      var dx = target.x - box.x;
      var dy = target.y - box.y;
      if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
        symbol.shiftX(dx);
        symbol.shiftY(dy);
        moved = true;
      }
      updatedBoxes[key] = symbolBox(symbol) || {
        x: target.x,
        y: target.y,
        w: box.w,
        h: box.h,
        cx: target.x + box.w / 2,
        cy: target.y + box.h / 2,
        left: target.x,
        right: target.x + box.w,
        top: target.y,
        bottom: target.y + box.h
      };
    });

    var assigned = assignTidyPorts(graph, updatedBoxes, layer, back);
    tidyLayout = {
      active: true,
      layer: layer,
      rows: rows,
      back: back,
      ports: assigned.from,
      toPorts: assigned.to
    };

    return moved;
  }

  function tidyEdgeSide(fromKey, toKey, source, target, boxes) {
    var rows = (tidyLayout && tidyLayout.rows) || [];
    var sourceRow = (tidyLayout && tidyLayout.layer && rows[tidyLayout.layer[fromKey]]) || [];
    var targetRow = (tidyLayout && tidyLayout.layer && rows[tidyLayout.layer[toKey]]) || [];

    function extremes(row) {
      var min = Infinity;
      var max = -Infinity;
      row.forEach(function (key) {
        var box = boxes[key];
        if (!box) return;
        min = Math.min(min, box.cx);
        max = Math.max(max, box.cx);
      });
      return { min: min, max: max };
    }

    var sourceExtremes = extremes(sourceRow);
    var targetExtremes = extremes(targetRow);
    var sourceRight = Math.abs(source.cx - sourceExtremes.max) < 1;
    var sourceLeft = Math.abs(source.cx - sourceExtremes.min) < 1;
    var targetRight = Math.abs(target.cx - targetExtremes.max) < 1;
    var targetLeft = Math.abs(target.cx - targetExtremes.min) < 1;

    if (sourceRight && targetRight) return 'right';
    if (sourceLeft && targetLeft) return 'left';
    if (sourceRight) return 'right';
    if (sourceLeft) return 'left';
    return target.cx >= source.cx ? 'right' : 'left';
  }

  function portPointFromBox(box, side) {
    if (side === 'top') return { x: box.cx, y: box.top };
    if (side === 'bottom') return { x: box.cx, y: box.bottom };
    if (side === 'left') return { x: box.left, y: box.cy };
    return { x: box.right, y: box.cy };
  }

  function portStubPoint(portPt, side, dist) {
    var d = dist || 18;
    if (side === 'top') return { x: portPt.x, y: portPt.y - d };
    if (side === 'bottom') return { x: portPt.x, y: portPt.y + d };
    if (side === 'left') return { x: portPt.x - d, y: portPt.y };
    return { x: portPt.x + d, y: portPt.y };
  }

  function polylineHitsObstacles(points, boxes, ignoreA, ignoreB, pad) {
    var margin = pad != null ? pad : 10;
    var keys = Object.keys(boxes || {});
    for (var i = 1; i < points.length; i++) {
      var p1 = points[i - 1];
      var p2 = points[i];
      if (Math.abs(p1.x - p2.x) < 0.5 && Math.abs(p1.y - p2.y) < 0.5) continue;

      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var isEndpoint = (key === ignoreA || key === ignoreB);
        var isFirstSeg = (i === 1 && key === ignoreA);
        var isLastSeg = (i === points.length - 1 && key === ignoreB);
        if (isFirstSeg || isLastSeg) continue;

        var b = boxes[key];
        if (!b) continue;
        var m = isEndpoint ? 2 : margin;
        var expanded = {
          minX: b.left - m,
          minY: b.top - m,
          maxX: b.right + m,
          maxY: b.bottom + m
        };
        if (segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, expanded)) {
          return true;
        }
      }
    }
    return false;
  }

  function separateParallelChannels(interiorPoints, start, end, channelMemory) {
    if (!channelMemory || !interiorPoints || !interiorPoints.length) return interiorPoints;
    var full = [start].concat(interiorPoints.map(function (p) { return { x: p.x, y: p.y }; }), [end]);

    for (var i = 1; i < full.length - 1; i++) {
      var a = full[i];
      var b = full[i + 1];
      if (i + 1 >= full.length - 1) break;

      var isHoriz = Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 8;
      var isVert = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 8;
      if (!isHoriz && !isVert) continue;

      var minSpan = isHoriz ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
      var maxSpan = isHoriz ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      var coord = isHoriz ? a.y : a.x;

      var bucket = isHoriz ? channelMemory.horiz : channelMemory.vert;
      var shift = 0;
      for (var attempt = 0; attempt < 6; attempt++) {
        var testCoord = coord + shift;
        var conflict = false;
        for (var j = 0; j < bucket.length; j++) {
          var item = bucket[j];
          if (Math.abs(item.coord - testCoord) < 9 &&
              Math.max(minSpan, item.min) < Math.min(maxSpan, item.max) - 4) {
            conflict = true;
            break;
          }
        }
        if (!conflict) {
          coord = testCoord;
          break;
        }
        var step = Math.ceil((attempt + 1) / 2) * 12;
        shift = (attempt % 2 === 0 ? 1 : -1) * step;
      }

      if (isHoriz) {
        a.y = coord;
        b.y = coord;
      } else {
        a.x = coord;
        b.x = coord;
      }
      bucket.push({ coord: coord, min: minSpan, max: maxSpan });
    }

    return full.slice(1, -1);
  }

  function routeAroundObstacles(start, end, fromSide, toSide, sourceKey, targetKey, boxes, channelMemory) {
    var stubLen = 20;
    var sStub = portStubPoint(start, fromSide, stubLen);
    var eStub = portStubPoint(end, toSide, stubLen);

    /* Straight line. */
    var facing = (fromSide === 'bottom' && toSide === 'top' && end.y > start.y + 4 && Math.abs(start.x - end.x) < 1.5) ||
                 (fromSide === 'top' && toSide === 'bottom' && end.y < start.y - 4 && Math.abs(start.x - end.x) < 1.5) ||
                 (fromSide === 'right' && toSide === 'left' && end.x > start.x + 4 && Math.abs(start.y - end.y) < 1.5) ||
                 (fromSide === 'left' && toSide === 'right' && end.x < start.x - 4 && Math.abs(start.y - end.y) < 1.5);
    if (facing && !polylineHitsObstacles([start, end], boxes, sourceKey, targetKey, 8)) {
      return [];
    }

    var candidates = [];
    var horizFrom = fromSide === 'left' || fromSide === 'right';
    var horizTo = toSide === 'left' || toSide === 'right';

    if (horizFrom && !horizTo) {
      var lCorner = { x: end.x, y: start.y };
      var validOut = (fromSide === 'right' && lCorner.x >= start.x + 8) || (fromSide === 'left' && lCorner.x <= start.x - 8);
      var validIn = (toSide === 'top' && end.y >= lCorner.y + 8) || (toSide === 'bottom' && end.y <= lCorner.y - 8);
      if (validOut && validIn) {
        candidates.push([lCorner]);
      }
    } else if (!horizFrom && horizTo) {
      var lCorner2 = { x: start.x, y: end.y };
      var validOut2 = (fromSide === 'bottom' && lCorner2.y >= start.y + 8) || (fromSide === 'top' && lCorner2.y <= start.y - 8);
      var validIn2 = (toSide === 'left' && end.x >= lCorner2.x + 8) || (toSide === 'right' && end.x <= lCorner2.x - 8);
      if (validOut2 && validIn2) {
        candidates.push([lCorner2]);
      }
    }

    if (!horizFrom && !horizTo && fromSide === 'bottom' && toSide === 'top' && end.y > start.y + 12) {
      var midY = (start.y + end.y) / 2;
      candidates.push([{ x: start.x, y: midY }, { x: end.x, y: midY }]);
    } else if (horizFrom && horizTo && ((fromSide === 'right' && toSide === 'left' && end.x > start.x + 12) ||
               (fromSide === 'left' && toSide === 'right' && end.x < start.x - 12))) {
      var midX = (start.x + end.x) / 2;
      candidates.push([{ x: midX, y: start.y }, { x: midX, y: end.y }]);
    }

    if (horizFrom && !horizTo && toSide === 'top' && end.y > start.y + 12) {
      var stepMidY = (start.y + end.y) / 2;
      candidates.push([
        { x: sStub.x, y: start.y },
        { x: sStub.x, y: stepMidY },
        { x: end.x, y: stepMidY }
      ]);
    }

    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      var testPoly = [start].concat(cand, [end]);
      if (!polylineHitsObstacles(testPoly, boxes, sourceKey, targetKey, 10)) {
        var separated = separateParallelChannels(cand, start, end, channelMemory);
        if (!polylineHitsObstacles([start].concat(separated, [end]), boxes, sourceKey, targetKey, 6)) {
          return separated.map(function (p) { return { x: roundCoord(p.x), y: roundCoord(p.y) }; });
        }
        return cand.map(function (p) { return { x: roundCoord(p.x), y: roundCoord(p.y) }; });
      }
    }

    /* Visibility grid search around obstacles. */
    var margin = 16;
    var xs = [start.x, end.x, sStub.x, eStub.x];
    var ys = [start.y, end.y, sStub.y, eStub.y];
    var minX = Math.min(start.x, end.x);
    var maxX = Math.max(start.x, end.x);
    var minY = Math.min(start.y, end.y);
    var maxY = Math.max(start.y, end.y);

    var boxList = [];
    Object.keys(boxes || {}).forEach(function (k) {
      var b = boxes[k];
      if (!b) return;
      boxList.push({ key: k, box: b });
      minX = Math.min(minX, b.left);
      maxX = Math.max(maxX, b.right);
      minY = Math.min(minY, b.top);
      maxY = Math.max(maxY, b.bottom);
      xs.push(b.left - margin, b.right + margin);
      ys.push(b.top - margin, b.bottom + margin);
    });

    /* Grid lines around obstacles and at the outer lanes. */
    var outerOffset = 28;
    xs.push(minX - outerOffset, minX - outerOffset * 1.8, maxX + outerOffset, maxX + outerOffset * 1.8);
    ys.push(minY - outerOffset, maxY + outerOffset);

    function uniqueSorted(arr) {
      var sorted = arr.slice().sort(function (a, b) { return a - b; });
      var out = [];
      for (var i = 0; i < sorted.length; i++) {
        if (!out.length || Math.abs(sorted[i] - out[out.length - 1]) > 1.5) {
          out.push(roundCoord(sorted[i]));
        }
      }
      return out;
    }

    var ux = uniqueSorted(xs);
    var uy = uniqueSorted(ys);

    function ensureCoord(list, val) {
      var r = roundCoord(val);
      for (var i = 0; i < list.length; i++) {
        if (Math.abs(list[i] - r) <= 1.5) {
          list[i] = r;
          return r;
        }
      }
      list.push(r);
      list.sort(function (a, b) { return a - b; });
      return r;
    }

    var sx = ensureCoord(ux, sStub.x);
    var sy = ensureCoord(uy, sStub.y);
    var ex = ensureCoord(ux, eStub.x);
    var ey = ensureCoord(uy, eStub.y);

    var W = ux.length;
    var H = uy.length;
    var sxi = ux.indexOf(sx);
    var syi = uy.indexOf(sy);
    var exi = ux.indexOf(ex);
    var eyi = uy.indexOf(ey);

    function pointBlocked(x, y) {
      for (var i = 0; i < boxList.length; i++) {
        var b = boxList[i].box;
        var pad = 10;
        if (x > b.left - pad && x < b.right + pad && y > b.top - pad && y < b.bottom + pad) {
          return true;
        }
      }
      return false;
    }

    function segBlocked(x1, y1, x2, y2) {
      for (var i = 0; i < boxList.length; i++) {
        var b = boxList[i].box;
        var pad = 10;
        if (segmentIntersectsBox(x1, y1, x2, y2, {
          minX: b.left - pad,
          minY: b.top - pad,
          maxX: b.right + pad,
          maxY: b.bottom + pad
        })) {
          return true;
        }
      }
      return false;
    }

    /* State id = ((yi * W + xi) * 4 + dir), dir: 0=E, 1=W, 2=S, 3=N */
    var dxDir = [1, -1, 0, 0];
    var dyDir = [0, 0, 1, -1];
    var totalStates = W * H * 4;
    var dist = new Float64Array(totalStates);
    var prev = new Int32Array(totalStates);
    for (var sIdx = 0; sIdx < totalStates; sIdx++) {
      dist[sIdx] = Infinity;
      prev[sIdx] = -1;
    }

    var initDir = fromSide === 'right' ? 0 : fromSide === 'left' ? 1 : fromSide === 'bottom' ? 2 : 3;
    var queue = [];

    function pushState(xi, yi, dir, cost, prevId) {
      var id = (yi * W + xi) * 4 + dir;
      if (cost >= dist[id]) return;
      dist[id] = cost;
      prev[id] = prevId;
      var h = Math.abs(ux[xi] - ex) + Math.abs(uy[yi] - ey);
      queue.push({ id: id, xi: xi, yi: yi, dir: dir, cost: cost, f: cost + h });
    }

    pushState(sxi, syi, initDir, 0, -1);

    var bestGoalId = -1;
    var bestGoalCost = Infinity;
    var bendPenalty = 45;
    var reverseDirs = [1, 0, 3, 2];

    while (queue.length > 0) {
      var bestIdx = 0;
      for (var q = 1; q < queue.length; q++) {
        if (queue[q].f < queue[bestIdx].f) bestIdx = q;
      }
      var cur = queue[bestIdx];
      queue[bestIdx] = queue[queue.length - 1];
      queue.pop();

      if (cur.cost > dist[cur.id]) continue;
      if (cur.cost >= bestGoalCost) continue;

      if (cur.xi === exi && cur.yi === eyi) {
        var endDir = toSide === 'left' ? 0 : toSide === 'right' ? 1 : toSide === 'top' ? 2 : 3;
        var finalCost = cur.cost + (cur.dir === endDir ? 0 : bendPenalty);
        if (finalCost < bestGoalCost) {
          bestGoalCost = finalCost;
          bestGoalId = cur.id;
        }
        continue;
      }

      for (var nd = 0; nd < 4; nd++) {
        if (nd === reverseDirs[cur.dir]) continue;
        var nxi = cur.xi + dxDir[nd];
        var nyi = cur.yi + dyDir[nd];
        if (nxi < 0 || nxi >= W || nyi < 0 || nyi >= H) continue;

        var nx = ux[nxi];
        var ny = uy[nyi];
        var isGoal = (nxi === exi && nyi === eyi);
        if (!isGoal && pointBlocked(nx, ny)) continue;
        if (segBlocked(ux[cur.xi], uy[cur.yi], nx, ny)) continue;

        var stepLen = Math.abs(nx - ux[cur.xi]) + Math.abs(ny - uy[cur.yi]);
        var turnCost = (nd === cur.dir) ? 0 : bendPenalty;
        pushState(nxi, nyi, nd, cur.cost + stepLen + turnCost, cur.id);
      }
    }

    if (bestGoalId !== -1) {
      var gridPts = [];
      var trace = bestGoalId;
      while (trace !== -1) {
        var cell = Math.floor(trace / 4);
        var cxi = cell % W;
        var cyi = Math.floor(cell / W);
        gridPts.push({ x: ux[cxi], y: uy[cyi] });
        trace = prev[trace];
      }
      gridPts.reverse();

      var rawAll = [start].concat(gridPts, [end]);
      var compactAll = compactOrthogonalPoints(orthogonalizePoints(rawAll));
      var interior = compactAll.slice(1, -1);
      var separatedInterior = separateParallelChannels(interior, start, end, channelMemory);
      if (!polylineHitsObstacles([start].concat(separatedInterior, [end]), boxes, sourceKey, targetKey, 6)) {
        interior = separatedInterior;
      }
      return interior.map(function (p) { return { x: roundCoord(p.x), y: roundCoord(p.y) }; });
    }

    var fallbackSide = end.x >= start.x ? 'right' : 'left';
    var laneX = fallbackSide === 'right' ? maxX + outerOffset : minX - outerOffset;
    var fallbackPts = compactOrthogonalPoints(orthogonalizePoints([
      start,
      sStub,
      { x: laneX, y: sStub.y },
      { x: laneX, y: eStub.y },
      eStub,
      end
    ])).slice(1, -1);
    return separateParallelChannels(fallbackPts, start, end, channelMemory).map(function (p) {
      return { x: roundCoord(p.x), y: roundCoord(p.y) };
    });
  }

  function computeTidyEdge(edge, boxes, channelMemory) {
    if (!edge || !edge.source || !edge.target) return null;

    var fromKey = edge.source.key;
    var toKey = edge.target.key;
    if (!fromKey || !toKey || fromKey === toKey) return null;

    var source = boxes[fromKey];
    var target = boxes[toKey];
    var fromLayer = tidyLayout.layer[fromKey];
    var toLayer = tidyLayout.layer[toKey];
    if (!source || !target || fromLayer == null || toLayer == null) return null;

    var eKey = edgeKey(fromKey, edge.branch);
    var isBack = tidyLayout.back && tidyLayout.back[fromKey + '\u0000' + toKey];
    var fromPort = (tidyLayout.ports && tidyLayout.ports[eKey]) || 'bottom';
    var toPort = (tidyLayout.toPorts && tidyLayout.toPorts[eKey]) || 'top';

    if (isBack || toLayer < fromLayer) {
      var side = tidyEdgeSide(fromKey, toKey, source, target, boxes);
      if (fromPort === 'bottom' || fromPort === 'top') fromPort = side;
      toPort = side;
    } else if (toLayer > fromLayer + 1) {
      var straightStart = portPointFromBox(source, fromPort);
      var straightEnd = portPointFromBox(target, toPort);
      if (fromPort === 'bottom' && polylineHitsObstacles([straightStart, straightEnd], boxes, fromKey, toKey, 10)) {
        var skipSide = tidyEdgeSide(fromKey, toKey, source, target, boxes);
        fromPort = skipSide;
        if (Math.abs(source.cx - target.cx) < 20) toPort = skipSide;
      }
    }

    var startPt = edgePortPoint(edge.source, fromPort);
    var endPt = edgePortPoint(edge.target, toPort);
    var waypoints = routeAroundObstacles(
      startPt,
      endPt,
      fromPort,
      toPort,
      fromKey,
      toKey,
      boxes,
      channelMemory
    );

    return {
      target: toKey,
      from: fromPort,
      to: toPort,
      points: waypoints,
      manual: true
    };
  }

  function tidyEdgeEntries(chart, edges) {
    var entries = new Map();
    if (!tidyLayout || !tidyLayout.active) return entries;

    var boxes = {};

    diagramSymbols(chart).forEach(function (symbol) {
      if (!symbol || !symbol.key) return;
      var box = symbolBox(symbol);
      if (!box) return;
      boxes[symbol.key] = box;
    });

    if (!Object.keys(boxes).length) return entries;

    var channelMemory = { horiz: [], vert: [] };

    edges.forEach(function (edge) {
      var entry = computeTidyEdge(edge, boxes, channelMemory);
      if (entry) entries.set(edge.uid, entry);
    });

    return entries;
  }

  function applySavedLayout(chart) {
    var moved = false;

    diagramSymbols(chart).forEach(function (symbol) {
      var saved = state.layout[symbol.key];
      if (!saved) return;
      var dx = Number(saved.x) - symbol.getX();
      var dy = Number(saved.y) - symbol.getY();
      if (!isFinite(dx) || !isFinite(dy)) return;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      symbol.shiftX(dx);
      symbol.shiftY(dy);
      moved = true;
    });

    return moved;
  }

  function clearConnections(chart) {
    var diagram = chart && chart.diagram;
    if (!diagram) return;

    clearEdgeLayers(chart);
    clearAllEdgeArrows();
    currentEdges = [];

    (diagram.lines || []).forEach(function (path) {
      if (!path) return;
      if (typeof path.remove === 'function') {
        try { path.remove(); } catch { /* ignore */ }
      } else if (path.node && path.node.parentNode) {
        path.node.parentNode.removeChild(path.node);
      }
    });
    diagram.lines.length = 0;

    var svg = diagram.paper && diagram.paper.canvas;
    if (svg) {
      Array.prototype.slice.call(svg.querySelectorAll('defs marker')).forEach(function (marker) {
        if (marker.parentNode) marker.parentNode.removeChild(marker);
      });

      var keep = nodeNodeSet(chart);
      Array.prototype.slice.call(svg.querySelectorAll('text')).forEach(function (node) {
        if (!keep.has(node) && node.parentNode) node.parentNode.removeChild(node);
      });
    }

    diagramSymbols(chart).forEach(function (symbol) {
      symbol.leftLines = [];
      symbol.rightLines = [];
      symbol.topLines = [];
      symbol.bottomLines = [];
      symbol.connectedTo = [];
    });
  }

  function tagConnectionArtifacts(chart, svg) {
    var diagram = chart && chart.diagram;
    if (!diagram || !svg) return;

    (diagram.lines || []).forEach(function (path) {
      if (path && path.node) path.node.setAttribute('data-connector', '');
    });

    var keep = nodeNodeSet(chart);
    Array.prototype.slice.call(svg.querySelectorAll('text')).forEach(function (node) {
      if (!keep.has(node)) node.setAttribute('data-connector-label', '');
    });
  }

  function hiddenEdgeMap() {
    var map = Object.create(null);
    state.hiddenEdges.forEach(function (entry) {
      map[hiddenSignatureOfEntry(entry)] = true;
    });
    return map;
  }

  function hideEdgeArtifacts(edge) {
    if (!edge) return;
    if (edge.path && edge.path.node) {
      edge.path.node.style.display = 'none';
      edge.path.node.setAttribute('data-hidden-edge', '');
    }
    if (edge.label && edge.label.node) {
      edge.label.node.style.display = 'none';
      edge.label.node.setAttribute('data-hidden-edge', '');
    }
  }

  function redrawConnections(chart, interactive) {
    var diagram = chart && chart.diagram;
    if (!diagram) return;

    clearConnections(chart);
    var allEdges = collectEdges(chart);
    var hidden = hiddenEdgeMap();

    if (state.hiddenEdges.length) {
      var present = Object.create(null);
      allEdges.forEach(function (edge) {
        present[hiddenSignatureOfEdge(edge)] = true;
      });
      var kept = state.hiddenEdges.filter(function (entry) {
        return present[hiddenSignatureOfEntry(entry)];
      });
      if (kept.length !== state.hiddenEdges.length) {
        state.hiddenEdges = kept;
        markSaving();
      }
      hidden = hiddenEdgeMap();
    }

    hiddenEdgeCount = 0;
    currentEdges = allEdges.filter(function (edge) {
      if (!hidden[hiddenSignatureOfEdge(edge)]) return true;
      hideEdgeArtifacts(edge);
      hiddenEdgeCount++;
      return false;
    });

    var overrides = new Map();
    state.edges.forEach(function (entry) {
      if (!entry || !entry.source || !entry.branch) return;
      overrides.set(edgeKey(entry.source, entry.branch), entry);
    });

    var tidyEntries = tidyEdgeEntries(chart, currentEdges);
    var applicableEntries = new Map();
    currentEdges.forEach(function (edge) {
      var entry = overrides.get(edge.key);
      var applicable = entry && (!entry.target || entry.target === edge.target.key) ? entry : null;
      if (!applicable) applicable = tidyEntries.get(edge.uid) || null;
      applicableEntries.set(edge.uid, applicable);
    });

    currentEdges.forEach(function (edge) {
      edge._skipStraight = false;
    });

    var straightGroups = {};
    currentEdges.forEach(function (edge) {
      var applicable = applicableEntries.get(edge.uid) || null;
      var straight = edgeStraightGeometry(edge, applicable);
      if (!straight) return;
      var key = [
        roundCoord(straight.start.x),
        roundCoord(straight.start.y),
        roundCoord(straight.end.x),
        roundCoord(straight.end.y)
      ].join(',');
      if (!straightGroups[key]) straightGroups[key] = [];
      straightGroups[key].push(edge);
    });

    Object.keys(straightGroups).forEach(function (key) {
      if (straightGroups[key].length > 1) {
        straightGroups[key].forEach(function (edge) {
          edge._skipStraight = true;
        });
      }
    });

    currentEdges.forEach(function (edge) {
      var applicable = applicableEntries.get(edge.uid) || null;
      if (applicable) applyEdgeGeometry(edge, applicable);
      normalizeAlignedEdge(edge, applicable);
    });

    applyLineJumps();

    var allSegments = [];
    currentEdges.forEach(function (edge) {
      var points = readPathPoints(edge.path);
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1];
        var b = points[i];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var length = Math.sqrt(dx * dx + dy * dy);
        if (length >= 0.5) allSegments.push({ a: a, b: b, dx: dx, dy: dy, length: length });
      }
    });

    var nodeObstacles = [];
    diagramSymbols(chart).forEach(function (symbol) {
      try {
        var box = symbol.group.getBBox();
        if (box && box.width && box.height) {
          nodeObstacles.push({ x: box.x, y: box.y, width: box.width, height: box.height });
        }
      } catch { /* ignore */ }
    });

    currentEdges.forEach(function (edge) {
      if (!edge.label) return;
      var points = readPathPoints(edge.path);
      if (points.length >= 2) positionEdgeLabel(edge, points, allSegments, nodeObstacles);
    });

    drawAllEdgeArrows();

    if (interactive !== false) buildEdgeInteractivity(chart);
    else hideEdgeToolbar();

    syncLayoutButton();
  }

  function tagLayoutTargets(chart, svg) {
    diagramSymbols(chart).forEach(function (symbol) {
      symbolNodes(symbol).forEach(function (node) {
        node.setAttribute('data-node', symbol.key);
      });
    });
    tagConnectionArtifacts(chart, svg);
  }

  function recomputeBounds(svg, chart) {
    if (!svg) return;

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    function include(box) {
      if (!box) return;
      var x = Number(box.x);
      var y = Number(box.y);
      var w = Number(box.width);
      var h = Number(box.height);
      if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return;
      if (w <= 0 || h <= 0) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    diagramSymbols(chart).forEach(function (symbol) {
      try { include(symbol.group.getBBox()); } catch { /* ignore */ }
    });

    var diagram = chart && chart.diagram;
    (diagram ? diagram.lines || [] : []).forEach(function (path) {
      if (path && path.node && path.node.getAttribute('data-hidden-edge') !== null) return;
      try { include(path.getBBox()); } catch { /* ignore */ }
    });

    Array.prototype.slice.call(svg.querySelectorAll('[data-connector-label]')).forEach(function (node) {
      if (node.getAttribute('data-hidden-edge') !== null) return;
      try { include(node.getBBox()); } catch { /* ignore */ }
    });

    Array.prototype.slice.call(svg.querySelectorAll('[data-edge-arrows] path, [data-edge-arrows] circle')).forEach(function (node) {
      try { include(node.getBBox()); } catch { /* ignore */ }
    });

    if (!isFinite(minX) || !isFinite(minY)) return;

    var pad = Math.max(4, Number(state.style.lineWidth) || 3);
    var x = Math.round((minX - pad) * 100) / 100;
    var y = Math.round((minY - pad) * 100) / 100;
    var w = Math.round((maxX - minX + pad * 2) * 100) / 100;
    var h = Math.round((maxY - minY + pad * 2) * 100) / 100;

    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
  }

  function clientToUser(svg, clientX, clientY) {
    if (!svg) return null;
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var box = readViewBox(svg);
    return {
      x: box.x + ((clientX - rect.left) * box.w) / rect.width,
      y: box.y + ((clientY - rect.top) * box.h) / rect.height
    };
  }

  function beginNodeDrag(event) {
    if (!lastSvg || !lastChart) return false;
    if (el.sheet.dataset.stale === 'true') return false;

    var origin = clientToUser(lastSvg, event.clientX, event.clientY);
    if (!origin) return false;

    var symbol = symbolAt(lastChart, origin);
    if (!symbol || !symbol.key) return false;

    var key = symbol.key;

    if (event.shiftKey) {
      toggleNodeSelection(key);
      return true;
    }

    clearEdgeSelection();
    clearAlignmentGuides();

    if (!isNodeSelected(key)) {
      selectedNodeKeys = [key];
    }

    var dragSymbols = [];
    selectedNodeKeys.forEach(function (selectedKey) {
      var item = symbolByKey(lastChart, selectedKey);
      if (!item) return;
      var box;
      try { box = item.group.getBBox(); } catch { return; }
      if (!box) return;
      dragSymbols.push({
        key: selectedKey,
        symbol: item,
        startX: item.getX(),
        startY: item.getY(),
        box: box
      });
    });

    if (!dragSymbols.length) return false;

    drawNodeSelectionOverlay();
    updateNodeToolbar();

    var peerBoxes = [];
    diagramSymbols(lastChart).forEach(function (other) {
      if (!other) return;
      if (dragSymbols.some(function (item) { return item.symbol === other; })) return;
      try {
        var box = other.group.getBBox();
        if (box && box.width && box.height) peerBoxes.push(box);
      } catch { /* ignore */ }
    });

    nodeDrag = {
      key: key,
      symbol: symbol,
      symbols: dragSymbols,
      pointerId: event.pointerId,
      origin: origin,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      startX: symbol.getX(),
      startY: symbol.getY(),
      startBox: symbol.group.getBBox(),
      peerBoxes: peerBoxes,
      startFit: fitMode,
      started: false,
      altKey: event.altKey,
      dx: 0,
      dy: 0,
      historySnapshot: captureManualState()
    };

    fitMode = false;
    el.viewport.setPointerCapture(event.pointerId);
    el.viewport.classList.add('dragging-node');
    lastSvg.setAttribute('data-dragging', 'true');
    return true;
  }

  function scheduleNodeDragFrame() {
    if (nodeDragFrame) return;
    nodeDragFrame = window.requestAnimationFrame(applyNodeDragFrame);
  }

  function clearAlignmentGuides() {
    if (!lastSvg) return;
    var layer = lastSvg.querySelector('[data-align-guide]');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function drawAlignmentGuides(guides) {
    clearAlignmentGuides();
    if (!lastSvg || !guides || (!guides.x && !guides.y)) return;

    var layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('data-align-guide', '');
    layer.setAttribute('pointer-events', 'none');

    var width = 1 / zoom;
    var dash = (4 / zoom) + ' ' + (3 / zoom);

    function addLine(x1, y1, x2, y2) {
      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(roundCoord(x1)));
      line.setAttribute('y1', String(roundCoord(y1)));
      line.setAttribute('x2', String(roundCoord(x2)));
      line.setAttribute('y2', String(roundCoord(y2)));
      line.setAttribute('stroke', '#e4572e');
      line.setAttribute('stroke-opacity', '0.55');
      line.setAttribute('stroke-width', String(width));
      line.setAttribute('stroke-dasharray', dash);
      layer.appendChild(line);
    }

    if (guides.x) addLine(guides.x.coord, guides.x.from, guides.x.coord, guides.x.to);
    if (guides.y) addLine(guides.y.from, guides.y.coord, guides.y.to, guides.y.coord);

    lastSvg.appendChild(layer);
  }

  function computeNodeAlignment(startBox, peerBoxes, dx, dy) {
    var threshold = 6 / zoom;
    var proposed = {
      x: startBox.x + dx,
      y: startBox.y + dy,
      w: startBox.width,
      h: startBox.height
    };
    var bestX = null;
    var bestY = null;
    var anchors = [0, 0.5, 1];

    peerBoxes.forEach(function (box) {
      anchors.forEach(function (own) {
        var ownX = proposed.x + proposed.w * own;
        anchors.forEach(function (their) {
          var theirX = box.x + box.width * their;
          var delta = theirX - ownX;
          if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
            bestX = { delta: delta, coord: theirX };
          }
        });
      });

      anchors.forEach(function (own) {
        var ownY = proposed.y + proposed.h * own;
        anchors.forEach(function (their) {
          var theirY = box.y + box.height * their;
          var delta = theirY - ownY;
          if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
            bestY = { delta: delta, coord: theirY };
          }
        });
      });
    });

    var finalBox = {
      x: proposed.x + (bestX ? bestX.delta : 0),
      y: proposed.y + (bestY ? bestY.delta : 0),
      w: proposed.w,
      h: proposed.h
    };
    var guides = {};

    if (bestX) {
      var minY = finalBox.y;
      var maxY = finalBox.y + finalBox.h;

      peerBoxes.forEach(function (box) {
        var candidates = [box.x, box.x + box.width / 2, box.x + box.width];
        if (candidates.some(function (value) { return Math.abs(value - bestX.coord) <= 0.5; })) {
          minY = Math.min(minY, box.y);
          maxY = Math.max(maxY, box.y + box.height);
        }
      });

      guides.x = { coord: bestX.coord, from: minY - 8, to: maxY + 8 };
    }

    if (bestY) {
      var minX = finalBox.x;
      var maxX = finalBox.x + finalBox.w;

      peerBoxes.forEach(function (box) {
        var candidates = [box.y, box.y + box.height / 2, box.y + box.height];
        if (candidates.some(function (value) { return Math.abs(value - bestY.coord) <= 0.5; })) {
          minX = Math.min(minX, box.x);
          maxX = Math.max(maxX, box.x + box.width);
        }
      });

      guides.y = { coord: bestY.coord, from: minX - 8, to: maxX + 8 };
    }

    return {
      deltaX: bestX ? bestX.delta : 0,
      deltaY: bestY ? bestY.delta : 0,
      guides: guides
    };
  }

  function applyNodeDragFrame() {
    nodeDragFrame = 0;
    if (!nodeDrag || !lastSvg) return;

    var point = clientToUser(lastSvg, nodeDrag.lastClientX, nodeDrag.lastClientY);
    if (!point) return;

    var dx = Math.round(point.x - nodeDrag.origin.x);
    var dy = Math.round(point.y - nodeDrag.origin.y);
    if (dx === nodeDrag.dx && dy === nodeDrag.dy) return;

    nodeDrag.dx = dx;
    nodeDrag.dy = dy;

    var align = nodeDrag.altKey
      ? { deltaX: 0, deltaY: 0, guides: {} }
      : computeNodeAlignment(nodeDrag.startBox, nodeDrag.peerBoxes, dx, dy);
    var finalDx = Math.round((dx + align.deltaX) * 10) / 10;
    var finalDy = Math.round((dy + align.deltaY) * 10) / 10;

    nodeDrag.symbols.forEach(function (item) {
      item.symbol.setX(item.startX + finalDx);
      item.symbol.setY(item.startY + finalDy);
    });

    redrawConnections(lastChart, false);
    drawAlignmentGuides(align.guides);
    drawNodeSelectionOverlay();
  }

  function finishNodeDrag(cancelled) {
    if (!nodeDrag) return;

    var drag = nodeDrag;
    nodeDrag = null;
    clearAlignmentGuides();

    if (nodeDragFrame) {
      window.cancelAnimationFrame(nodeDragFrame);
      nodeDragFrame = 0;
    }
    if (lastSvg) lastSvg.removeAttribute('data-dragging');
    el.viewport.classList.remove('dragging-node');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }

    if (cancelled) {
      if (drag.started) {
        drag.symbols.forEach(function (item) {
          item.symbol.setX(item.startX);
          item.symbol.setY(item.startY);
        });
        if (lastChart) redrawConnections(lastChart, true);
        drawNodeSelectionOverlay();
      }
      fitMode = drag.startFit;
      return;
    }

    if (!drag.started) {
      fitMode = drag.startFit;
      return;
    }

    var changed = false;
    drag.symbols.forEach(function (item) {
      var nextX = Math.round(item.symbol.getX());
      var nextY = Math.round(item.symbol.getY());
      if (Math.abs(nextX - item.startX) >= 1 || Math.abs(nextY - item.startY) >= 1) {
        item.symbol.setX(nextX);
        item.symbol.setY(nextY);
        state.layout[item.key] = { x: nextX, y: nextY };
        changed = true;
      }
    });

    if (!changed) {
      fitMode = drag.startFit;
      drawNodeSelectionOverlay();
      return;
    }

    pushHistorySnapshot(drag.historySnapshot);
    markSaving();
    syncLayoutButton();

    var previousBox = lastSvg ? readViewBox(lastSvg) : null;
    if (lastSvg && lastChart) recomputeBounds(lastSvg, lastChart);

    if (drag.startFit) {
      fitMode = true;
      fitToView();
    } else if (previousBox && lastSvg) {
      var nextBox = readViewBox(lastSvg);
      pan.x += ((nextBox.x + nextBox.w / 2) - (previousBox.x + previousBox.w / 2)) * zoom;
      pan.y += ((nextBox.y + nextBox.h / 2) - (previousBox.y + previousBox.h / 2)) * zoom;
      applyTransform();
    }

    if (lastChart) buildEdgeInteractivity(lastChart);
    drawNodeSelectionOverlay();

    toast(
      drag.symbols.length > 1 ? ('已移动 ' + drag.symbols.length + ' 个节点') : ('已移动节点：' + drag.key),
      '撤销',
      undoManual
    );
  }

  function abortNodeDrag() {
    if (!nodeDrag) return;

    var drag = nodeDrag;
    nodeDrag = null;
    clearAlignmentGuides();

    if (nodeDragFrame) {
      window.cancelAnimationFrame(nodeDragFrame);
      nodeDragFrame = 0;
    }
    if (lastSvg) lastSvg.removeAttribute('data-dragging');
    el.viewport.classList.remove('dragging-node');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }

    fitMode = drag.startFit;
    if (drag.started) {
      drag.symbols.forEach(function (item) {
        item.symbol.setX(item.startX);
        item.symbol.setY(item.startY);
      });
      if (lastChart) redrawConnections(lastChart, true);
      drawNodeSelectionOverlay();
    }
  }

  function resetLayout() {
    if (!hasManualLayout() && !hasEdgeOverrides() && !state.hiddenEdges.length) {
      toast('当前没有手动调整。', null, null, 'warn');
      return;
    }

    var snapshot = captureManualState();
    state.layout = {};
    state.edges = [];
    state.hiddenEdges = [];
    clearEdgeSelection();
    clearNodeSelection();
    pushHistorySnapshot(snapshot);
    persist();
    syncLayoutButton();
    fitMode = true;
    renderNow({ animate: false });
    requestAnimationFrame(fitToView);
    toast('已恢复自动排版与连线。', '撤销', undoManual);
  }

  /* ---------------------------------------------------------------------- */
  /* Node selection                                                          */
  /* ---------------------------------------------------------------------- */

  function symbolByKey(chart, key) {
    var symbols = diagramSymbols(chart);
    for (var i = 0; i < symbols.length; i++) {
      if (symbols[i].key === key) return symbols[i];
    }
    return null;
  }

  function isNodeSelected(key) {
    return selectedNodeKeys.indexOf(key) !== -1;
  }

  function clearNodeSelectionOverlay() {
    if (!lastSvg) return;
    var layer = lastSvg.querySelector('[data-node-select]');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function drawNodeSelectionOverlay() {
    clearNodeSelectionOverlay();
    if (!lastSvg || !lastChart) return;

    selectedNodeKeys = selectedNodeKeys.filter(function (key) {
      return Boolean(symbolByKey(lastChart, key));
    });

    if (!selectedNodeKeys.length) {
      hideNodeToolbar();
      drawNodePortHandles();
      return;
    }

    var layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('data-node-select', '');
    layer.setAttribute('pointer-events', 'none');

    var stroke = 1 / zoom;
    var dash = (4 / zoom) + ' ' + (3 / zoom);

    selectedNodeKeys.forEach(function (key) {
      var symbol = symbolByKey(lastChart, key);
      if (!symbol) return;

      var box;
      try { box = symbol.group.getBBox(); } catch { return; }
      if (!box) return;

      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(roundCoord(box.x - 3)));
      rect.setAttribute('y', String(roundCoord(box.y - 3)));
      rect.setAttribute('width', String(roundCoord(box.width + 6)));
      rect.setAttribute('height', String(roundCoord(box.height + 6)));
      rect.setAttribute('rx', String(2 / zoom));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#e4572e');
      rect.setAttribute('stroke-opacity', '0.8');
      rect.setAttribute('stroke-width', String(stroke));
      rect.setAttribute('stroke-dasharray', dash);
      layer.appendChild(rect);
    });

    lastSvg.appendChild(layer);
    drawNodePortHandles();
  }

  function hideNodeToolbar() {
    if (el.nodeToolbar) el.nodeToolbar.hidden = true;
  }

  function positionNodeToolbar() {
    if (!el.nodeToolbar || el.nodeToolbar.hidden) return;

    var rect = el.viewport.getBoundingClientRect();
    var width = el.nodeToolbar.offsetWidth || 160;
    var left = Math.round(rect.right - width - 12) + 'px';
    var top = Math.round(rect.top + 12) + 'px';
    if (el.nodeToolbar.style.left !== left) el.nodeToolbar.style.left = left;
    if (el.nodeToolbar.style.top !== top) el.nodeToolbar.style.top = top;
  }

  function updateNodeToolbar() {
    if (!el.nodeToolbar) return;
    var rect = el.viewport.getBoundingClientRect();
    var show = selectedNodeKeys.length >= 3 && rect.width > 0;
    el.nodeToolbar.hidden = !show;
    if (show) positionNodeToolbar();
  }

  function clearNodeSelection() {
    selectedNodeKeys = [];
    clearNodeSelectionOverlay();
    hideNodeToolbar();
    drawNodePortHandles();
  }

  function toggleNodeSelection(key) {
    clearEdgeSelection();
    var index = selectedNodeKeys.indexOf(key);
    if (index >= 0) selectedNodeKeys.splice(index, 1);
    else selectedNodeKeys.push(key);
    clearAlignmentGuides();
    drawNodeSelectionOverlay();
    updateNodeToolbar();
  }

  function drawMarqueeRect(rect) {
    if (!lastSvg) return;
    var node = lastSvg.querySelector('[data-marquee]');
    if (!node) {
      node = document.createElementNS(SVG_NS, 'rect');
      node.setAttribute('data-marquee', '');
      node.setAttribute('pointer-events', 'none');
      node.setAttribute('fill', '#e4572e');
      node.setAttribute('fill-opacity', '0.06');
      node.setAttribute('stroke', '#e4572e');
      node.setAttribute('stroke-opacity', '0.7');
      lastSvg.appendChild(node);
    }
    node.setAttribute('x', String(roundCoord(rect.x)));
    node.setAttribute('y', String(roundCoord(rect.y)));
    node.setAttribute('width', String(Math.max(0, roundCoord(rect.w))));
    node.setAttribute('height', String(Math.max(0, roundCoord(rect.h))));
    node.setAttribute('stroke-width', String(1 / zoom));
    node.setAttribute('stroke-dasharray', (4 / zoom) + ' ' + (3 / zoom));
  }

  function clearMarqueeRect() {
    if (!lastSvg) return;
    var node = lastSvg.querySelector('[data-marquee]');
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function startMarqueeSelection(event) {
    if (!lastSvg || !lastChart) return false;
    if (el.sheet.dataset.stale === 'true') return false;

    var origin = clientToUser(lastSvg, event.clientX, event.clientY);
    if (!origin) return false;

    clearEdgeSelection();
    clearAlignmentGuides();
    marqueeDrag = {
      pointerId: event.pointerId,
      origin: origin,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      base: selectedNodeKeys.slice(),
      started: false,
      frame: 0
    };

    el.viewport.setPointerCapture(event.pointerId);
    el.viewport.classList.add('marquee-selecting');
    return true;
  }

  function moveMarquee(event) {
    if (!marqueeDrag || event.pointerId !== marqueeDrag.pointerId) return;
    if (!marqueeDrag.started) {
      if (Math.abs(event.clientX - marqueeDrag.startClientX) < 3 &&
          Math.abs(event.clientY - marqueeDrag.startClientY) < 3) return;
      marqueeDrag.started = true;
    }
    marqueeDrag.lastClientX = event.clientX;
    marqueeDrag.lastClientY = event.clientY;
    if (marqueeDrag.frame) return;
    marqueeDrag.frame = window.requestAnimationFrame(applyMarqueeFrame);
  }

  function applyMarqueeFrame() {
    if (!marqueeDrag) return;
    marqueeDrag.frame = 0;
    if (!lastSvg || !lastChart) return;

    var end = clientToUser(lastSvg, marqueeDrag.lastClientX, marqueeDrag.lastClientY);
    if (!end) return;

    var origin = marqueeDrag.origin;
    var rect = {
      x: Math.min(origin.x, end.x),
      y: Math.min(origin.y, end.y),
      w: Math.abs(end.x - origin.x),
      h: Math.abs(end.y - origin.y)
    };
    drawMarqueeRect(rect);

    var keys = marqueeDrag.base.slice();
    diagramSymbols(lastChart).forEach(function (symbol) {
      if (!symbol || !symbol.key) return;
      var box;
      try { box = symbol.group.getBBox(); } catch { return; }
      if (!box) return;
      var intersects = box.x < rect.x + rect.w && box.x + box.width > rect.x &&
        box.y < rect.y + rect.h && box.y + box.height > rect.y;
      if (intersects && keys.indexOf(symbol.key) === -1) keys.push(symbol.key);
    });

    selectedNodeKeys = keys;
    drawNodeSelectionOverlay();
    updateNodeToolbar();
  }

  function finishMarquee(cancelled) {
    if (!marqueeDrag) return;

    var drag = marqueeDrag;
    marqueeDrag = null;
    if (drag.frame) {
      window.cancelAnimationFrame(drag.frame);
      drag.frame = 0;
    }
    el.viewport.classList.remove('marquee-selecting');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }
    clearMarqueeRect();

    if (cancelled) selectedNodeKeys = drag.base;
    drawNodeSelectionOverlay();
    updateNodeToolbar();
  }

  function distributeSelectedNodes(axis) {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再调整。', null, null, 'warn');
      return;
    }
    if (!lastChart || selectedNodeKeys.length < 3) {
      toast('至少选择 3 个节点。', null, null, 'warn');
      return;
    }

    var horizontal = axis !== 'vertical';
    var items = [];

    selectedNodeKeys.forEach(function (key) {
      var symbol = symbolByKey(lastChart, key);
      if (!symbol) return;
      var box;
      try { box = symbol.group.getBBox(); } catch { return; }
      if (!box) return;
      items.push({ key: key, symbol: symbol, box: box });
    });

    if (items.length < 3) {
      toast('至少选择 3 个节点。', null, null, 'warn');
      return;
    }

    items.sort(function (a, b) {
      return horizontal ? a.box.x - b.box.x : a.box.y - b.box.y;
    });

    var first = items[0];
    var last = items[items.length - 1];
    var start = horizontal ? first.box.x : first.box.y;
    var end = horizontal ? (last.box.x + last.box.width) : (last.box.y + last.box.height);
    var total = 0;
    items.forEach(function (item) {
      total += horizontal ? item.box.width : item.box.height;
    });

    var gap = (end - start - total) / (items.length - 1);
    var snapshot = captureManualState();
    var cursor = start;

    items.forEach(function (item, index) {
      var size = horizontal ? item.box.width : item.box.height;
      var target;

      if (index === 0) {
        target = start;
      } else if (index === items.length - 1) {
        target = horizontal ? last.box.x : last.box.y;
      } else {
        target = cursor;
      }

      if (index < items.length - 1) {
        cursor = target + size + gap;
      }

      var current = state.layout[item.key] || { x: item.symbol.getX(), y: item.symbol.getY() };
      if (horizontal) {
        state.layout[item.key] = { x: Math.round(target * 10) / 10, y: current.y };
      } else {
        state.layout[item.key] = { x: current.x, y: Math.round(target * 10) / 10 };
      }
    });

    pushHistorySnapshot(snapshot);
    markSaving();
    syncLayoutButton();
    renderNow({ animate: false });
    drawNodeSelectionOverlay();
    updateNodeToolbar();

    toast(horizontal ? '已水平等距分布。' : '已垂直等距分布。', '撤销', undoManual);
  }

  /* ---------------------------------------------------------------------- */
  /* Connectors                                                              */
  /* ---------------------------------------------------------------------- */

  function sanitizeEdgeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    var source = typeof entry.source === 'string' ? entry.source : '';
    var branch = typeof entry.branch === 'string' ? entry.branch : '';
    var from = EDGE_SIDE_SET[entry.from] ? entry.from : '';
    var to = EDGE_SIDE_SET[entry.to] ? entry.to : '';
    if (!source || !EDGE_BRANCH_SET[branch] || !from || !to) return null;

    var points = [];
    if (Array.isArray(entry.points)) {
      entry.points.slice(0, 40).forEach(function (point) {
        if (!point || typeof point !== 'object') return;
        var x = Number(point.x);
        var y = Number(point.y);
        if (!isFinite(x) || !isFinite(y)) return;
        points.push({ x: clamp(x, -20000, 20000), y: clamp(y, -20000, 20000) });
      });
    }

    points = compactOrthogonalPoints(orthogonalizePoints(points));

    return {
      source: source,
      branch: branch,
      target: typeof entry.target === 'string' ? entry.target : '',
      from: from,
      to: to,
      points: points,
      manual: typeof entry.manual === 'boolean' ? entry.manual : points.length > 0
    };
  }

  function edgeKey(source, branch) {
    return source + '\u0000' + branch;
  }

  function cloneEdgeEntry(entry) {
    if (!entry) return null;
    return {
      source: entry.source,
      branch: entry.branch,
      target: entry.target,
      from: entry.from,
      to: entry.to,
      manual: entry.manual === true,
      points: (entry.points || []).map(function (point) {
        return { x: point.x, y: point.y };
      })
    };
  }

  function hasEdgeOverrides() {
    return state.edges.length > 0;
  }

  function findEdgeEntry(source, branch) {
    for (var i = 0; i < state.edges.length; i++) {
      if (state.edges[i].source === source && state.edges[i].branch === branch) return state.edges[i];
    }
    return null;
  }

  function findEdgeOverride(edge) {
    var entry = findEdgeEntry(edge.source.key, edge.branch);
    if (!entry) return null;
    if (entry.target && entry.target !== edge.target.key) return null;
    return entry;
  }

  function removeEdgeEntry(entry) {
    var index = state.edges.indexOf(entry);
    if (index >= 0) state.edges.splice(index, 1);
  }

  function restoreEdgeEntry(entry, snapshot) {
    if (!entry) return;
    if (!snapshot) {
      removeEdgeEntry(entry);
      return;
    }
    entry.target = snapshot.target;
    entry.from = snapshot.from;
    entry.to = snapshot.to;
    entry.manual = snapshot.manual === true;
    entry.points = snapshot.points.map(function (point) {
      return { x: point.x, y: point.y };
    });
  }

  function edgeBranches(symbol) {
    var list = [];

    function add(branch, target, direction, label) {
      if (!target) return;
      list.push({ branch: branch, target: target, direction: direction, label: label || '' });
    }

    if (symbol.yes_symbol || symbol.no_symbol) {
      add('yes', symbol.yes_symbol, symbol.yes_direction,
        symbol.yes_annotation ? symbol.yes_annotation : symbol.getAttr('yes-text'));
      add('no', symbol.no_symbol, symbol.no_direction,
        symbol.no_annotation ? symbol.no_annotation : symbol.getAttr('no-text'));
    } else if (symbol.path1_symbol || symbol.path2_symbol || symbol.path3_symbol) {
      add('path1', symbol.path1_symbol, symbol.path1_direction, symbol.path1_annotation);
      add('path2', symbol.path2_symbol, symbol.path2_direction, symbol.path2_annotation);
      add('path3', symbol.path3_symbol, symbol.path3_direction, symbol.path3_annotation);
    } else if (symbol.next) {
      add('next', symbol.next, symbol.next_direction, symbol.getAttr('arrow-text') || '');
    }

    return list;
  }

  function captureTextElements(paper, draw) {
    var captured = [];
    var original = paper.text;

    paper.text = function () {
      var element = original.apply(paper, arguments);
      captured.push(element);
      return element;
    };

    try {
      draw();
    } finally {
      paper.text = original;
    }

    return captured;
  }

  function collectEdges(chart) {
    var diagram = chart && chart.diagram;
    var paper = diagram && diagram.paper;
    var edges = [];
    if (!diagram || !paper || !diagram.lines) return edges;

    var index = 0;
    diagramSymbols(chart).forEach(function (symbol) {
      edgeBranches(symbol).forEach(function (branch) {
        var before = diagram.lines.length;
        var texts = captureTextElements(paper, function () {
          symbol.drawLineTo(branch.target, branch.label, branch.direction);
        });

        var path = diagram.lines[before];
        if (!path || !path.node) return;

        var edge = {
          uid: 'e' + index++,
          key: edgeKey(symbol.key, branch.branch),
          source: symbol,
          branch: branch.branch,
          target: branch.target,
          path: path,
          label: texts[0] || null
        };

        path.node.setAttribute('data-edge', edge.uid);
        if (edge.label && edge.label.node) edge.label.node.setAttribute('data-edge-label', edge.uid);
        edges.push(edge);
      });
    });

    return edges;
  }

  function readPathPoints(path) {
    var points = [];
    try {
      var commands = path.attr('path') || [];
      commands.forEach(function (command) {
        if (!command) return;
        var type = command[0];
        if (type === 'M' || type === 'L') {
          points.push({ x: Number(command[1]), y: Number(command[2]) });
        } else if (type === 'C') {
          points.push({ x: Number(command[5]), y: Number(command[6]) });
        }
      });
    } catch { /* ignore */ }
    return points;
  }

  function roundCoord(value) {
    return Math.round(value * 10) / 10;
  }

  /* Arrowheads are plain SVG shapes, independent of Raphael markers. */
  function edgeArrowColor(edge) {
    var color = '';
    try {
      color = edge.path.node.getAttribute('stroke') || edge.path.attr('stroke') || '';
    } catch {
      color = '';
    }
    if (color && color !== 'none') return color;
    var theme = THEMES[state.theme] || THEMES.drafting;
    return theme.flow['line-color'] || '#1b1e17';
  }

  function edgeArrowLayer() {
    if (!lastSvg) return null;
    var layer = lastSvg.querySelector('[data-edge-arrows]');
    if (layer) return layer;

    layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('data-edge-arrows', '');
    layer.setAttribute('pointer-events', 'none');
    var before = lastSvg.querySelector('[data-edge-hit], [data-edge-ui], [data-port-ui]');
    lastSvg.insertBefore(layer, before || null);
    return layer;
  }

  function clearAllEdgeArrows() {
    if (!lastSvg) return;
    var layer = lastSvg.querySelector('[data-edge-arrows]');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
  }

  function clearEdgeArrow(edge) {
    if (!lastSvg || !edge) return;
    var node = lastSvg.querySelector('[data-edge-arrow="' + edge.uid + '"]');
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function drawEdgeArrow(edge) {
    if (!lastSvg || !edge || !edge.path || !edge.path.node) return;

    var layer = edgeArrowLayer();
    if (!layer) return;

    clearEdgeArrow(edge);
    /* Remove markers added by flowchart.js or style annotations. */
    edge.path.node.removeAttribute('marker-end');
    edge.path.node.removeAttribute('marker-start');

    var points = readPathPoints(edge.path);
    if (points.length < 2) return;

    var end = points[points.length - 1];
    var previous = null;
    for (var i = points.length - 2; i >= 0; i--) {
      var ddx = end.x - points[i].x;
      var ddy = end.y - points[i].y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) >= 0.5) {
        previous = points[i];
        break;
      }
    }
    if (!previous) return;

    var dx = end.x - previous.x;
    var dy = end.y - previous.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return;

    var ux = dx / len;
    var uy = dy / len;
    var nx = -uy;
    var ny = ux;
    var lineWidth = Number(state.style.lineWidth) || 3;
    var style = state.style.arrow || 'classic';
    var color = edgeArrowColor(edge);

    var group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-edge-arrow', edge.uid);
    group.setAttribute('pointer-events', 'none');

    if (style === 'oval') {
      var radius = 3 + lineWidth * 0.65;
      var circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(roundCoord(end.x - ux * radius)));
      circle.setAttribute('cy', String(roundCoord(end.y - uy * radius)));
      circle.setAttribute('r', String(roundCoord(radius)));
      circle.setAttribute('fill', color);
      group.appendChild(circle);
    } else {
      var length = 8 + lineWidth * 1.5;
      var half = 3 + lineWidth * 0.75;
      if (style === 'classic-wide-long') {
        length += 4;
        half += 0.5;
      } else if (style === 'block') {
        length = 7 + lineWidth * 1.2;
      }

      var tipX = roundCoord(end.x);
      var tipY = roundCoord(end.y);
      var backX = end.x - ux * length;
      var backY = end.y - uy * length;
      var leftX = roundCoord(backX + nx * half);
      var leftY = roundCoord(backY + ny * half);
      var rightX = roundCoord(backX - nx * half);
      var rightY = roundCoord(backY - ny * half);

      var path = document.createElementNS(SVG_NS, 'path');
      if (style === 'classic' || style === 'classic-wide-long') {
        var notchX = roundCoord(backX + ux * length * 0.32);
        var notchY = roundCoord(backY + uy * length * 0.32);
        path.setAttribute('d', 'M' + tipX + ',' + tipY +
          ' L' + leftX + ',' + leftY +
          ' L' + notchX + ',' + notchY +
          ' L' + rightX + ',' + rightY + ' Z');
      } else {
        path.setAttribute('d', 'M' + tipX + ',' + tipY +
          ' L' + leftX + ',' + leftY +
          ' L' + rightX + ',' + rightY + ' Z');
      }
      path.setAttribute('fill', color);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(Math.max(0.5, lineWidth * 0.35)));
      path.setAttribute('stroke-linejoin', 'miter');
      group.appendChild(path);
    }

    layer.appendChild(group);
  }

  function drawAllEdgeArrows() {
    clearAllEdgeArrows();
    currentEdges.forEach(drawEdgeArrow);
  }

  function edgePortPoint(symbol, side) {
    var x = symbol.getX();
    var y = symbol.getY();
    var box = symbol.group.getBBox();

    if (side === 'top') return { x: x + symbol.width / 2, y: y };
    if (side === 'bottom') return { x: x + symbol.width / 2, y: y + symbol.height };
    if (side === 'left') return { x: x, y: y + box.height / 2 };
    return { x: x + box.width, y: y + box.height / 2 };
  }

  function edgeNearestSide(symbol, point) {
    var best = 'top';
    var bestDistance = Infinity;

    EDGE_SIDES.forEach(function (side) {
      var port = edgePortPoint(symbol, side);
      var dx = point.x - port.x;
      var dy = point.y - port.y;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = side;
      }
    });

    return best;
  }

  function ensureEdgeOverride(edge) {
    var points = readPathPoints(edge.path);
    if (points.length < 2) {
      points = [edgePortPoint(edge.source, 'bottom'), edgePortPoint(edge.target, 'top')];
    }

    var from = edgeNearestSide(edge.source, points[0]);
    var to = edgeNearestSide(edge.target, points[points.length - 1]);
    var waypoints = points.slice(1, -1).map(function (point) {
      return { x: roundCoord(point.x), y: roundCoord(point.y) };
    });

    var entry = findEdgeEntry(edge.source.key, edge.branch);
    if (!entry) {
      entry = {
        source: edge.source.key,
        branch: edge.branch,
        target: edge.target.key,
        from: from,
        to: to,
        manual: false,
        points: waypoints
      };
      state.edges.push(entry);
      return entry;
    }

    if (entry.target && entry.target !== edge.target.key) {
      entry.target = edge.target.key;
      entry.from = from;
      entry.to = to;
      entry.manual = false;
      entry.points = waypoints;
    }

    return entry;
  }

  function materializeEdgeElbows(edge, entry) {
    if (entry.points && entry.points.length) return;

    var start = edgePortPoint(edge.source, entry.from);
    var end = edgePortPoint(edge.target, entry.to);
    var elbows = defaultEdgeElbows(start, end, entry.from, entry.to);
    var cleaned = cleanEdgePoints([start].concat(elbows, [end]));

    entry.points = cleaned.slice(1, -1).map(function (point) {
      return { x: roundCoord(point.x), y: roundCoord(point.y) };
    });
  }

  function defaultEdgeElbows(start, end, from, to) {
    var horizontalFrom = from === 'left' || from === 'right';
    var horizontalTo = to === 'left' || to === 'right';

    if (horizontalFrom && horizontalTo) {
      var midX = (start.x + end.x) / 2;
      return [{ x: midX, y: start.y }, { x: midX, y: end.y }];
    }

    if (!horizontalFrom && !horizontalTo) {
      var midY = (start.y + end.y) / 2;
      return [{ x: start.x, y: midY }, { x: end.x, y: midY }];
    }

    if (horizontalFrom) return [{ x: end.x, y: start.y }];
    return [{ x: start.x, y: end.y }];
  }

  function cleanEdgePoints(points) {
    var compact = [];
    points.forEach(function (point) {
      var last = compact[compact.length - 1];
      if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) {
        compact.push({ x: point.x, y: point.y });
      }
    });

    if (compact.length < 3) return compact;

    var cleaned = [compact[0]];
    for (var i = 1; i < compact.length - 1; i++) {
      var a = cleaned[cleaned.length - 1];
      var b = compact[i];
      var c = compact[i + 1];
      var cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cross) > 0.01) cleaned.push(b);
    }
    cleaned.push(compact[compact.length - 1]);
    return cleaned;
  }

  function orthogonalizePoints(points) {
    if (!points || points.length < 2) return points ? points.slice() : [];

    var tolerance = 0.5;
    var result = [{ x: points[0].x, y: points[0].y }];

    for (var i = 1; i < points.length; i++) {
      var previous = result[result.length - 1];
      var current = { x: points[i].x, y: points[i].y };

      if (Math.abs(current.x - previous.x) <= tolerance && Math.abs(current.y - previous.y) > tolerance) {
        current.x = previous.x;
      } else if (Math.abs(current.y - previous.y) <= tolerance && Math.abs(current.x - previous.x) > tolerance) {
        current.y = previous.y;
      }

      if (Math.abs(previous.x - current.x) > tolerance && Math.abs(previous.y - current.y) > tolerance) {
        var next = points[i + 1];
        var elbow;
        if (next && Math.abs(next.y - current.y) <= tolerance) {
          elbow = { x: current.x, y: previous.y };
        } else if (next && Math.abs(next.x - current.x) <= tolerance) {
          elbow = { x: previous.x, y: current.y };
        } else {
          elbow = { x: current.x, y: previous.y };
        }
        result.push(elbow);
      }

      result.push(current);
    }

    return result;
  }

  function compactOrthogonalPoints(points, snapTol) {
    if (!points || points.length < 3) {
      return (points || []).map(function (point) { return { x: point.x, y: point.y }; });
    }

    var tol = snapTol != null ? snapTol : 6.5;
    var work = points.map(function (point) { return { x: point.x, y: point.y }; });

    /* Collapse stair-steps shorter than tol. */
    for (var pass = 0; pass < 3; pass++) {
      if (work.length < 4) break;
      var changed = false;
      for (var j = 1; j < work.length - 2; j++) {
        var p0 = work[j - 1];
        var p1 = work[j];
        var p2 = work[j + 1];
        var p3 = work[j + 2];
        var segDx = Math.abs(p2.x - p1.x);
        var segDy = Math.abs(p2.y - p1.y);

        if (segDy <= 0.5 && segDx <= tol && Math.abs(p1.x - p0.x) <= 0.5 && Math.abs(p3.x - p2.x) <= 0.5) {
          var pinStartX = (j - 1 === 0);
          var pinEndX = (j + 2 === work.length - 1);
          if (!(pinStartX && pinEndX && Math.abs(p0.x - p3.x) > 0.8)) {
            var targetX = pinStartX ? p0.x : pinEndX ? p3.x : p0.x;
            p1.x = targetX;
            p2.x = targetX;
            if (!pinStartX) p0.x = targetX;
            if (!pinEndX) p3.x = targetX;
            changed = true;
          }
        } else if (segDx <= 0.5 && segDy <= tol && Math.abs(p1.y - p0.y) <= 0.5 && Math.abs(p3.y - p2.y) <= 0.5) {
          var pinStartY = (j - 1 === 0);
          var pinEndY = (j + 2 === work.length - 1);
          if (!(pinStartY && pinEndY && Math.abs(p0.y - p3.y) > 0.8)) {
            var targetY = pinStartY ? p0.y : pinEndY ? p3.y : p0.y;
            p1.y = targetY;
            p2.y = targetY;
            if (!pinStartY) p0.y = targetY;
            if (!pinEndY) p3.y = targetY;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    var result = [{ x: work[0].x, y: work[0].y }];

    for (var i = 1; i < work.length - 1; i++) {
      var a = result[result.length - 1];
      var b = work[i];
      var c = work[i + 1];
      var sameX = Math.abs(a.x - b.x) <= 0.8 && Math.abs(b.x - c.x) <= 0.8;
      var sameY = Math.abs(a.y - b.y) <= 0.8 && Math.abs(b.y - c.y) <= 0.8;
      if (sameX) {
        b.x = a.x;
        c.x = a.x;
      } else if (sameY) {
        b.y = a.y;
        c.y = a.y;
      } else {
        result.push({ x: b.x, y: b.y });
      }
    }

    result.push({ x: work[work.length - 1].x, y: work[work.length - 1].y });
    return result;
  }

  function currentObstacleBoxes(chart) {
    var boxes = {};
    if (!chart) return boxes;
    diagramSymbols(chart).forEach(function (symbol) {
      if (!symbol || !symbol.key) return;
      var box = symbolBox(symbol);
      if (box) boxes[symbol.key] = box;
    });
    return boxes;
  }

  function edgeGeometryPoints(edge, entry) {
    var start = edgePortPoint(edge.source, entry.from);
    var end = edgePortPoint(edge.target, entry.to);
    var points = [start];

    if (entry.points && entry.points.length) {
      entry.points.forEach(function (point) {
        points.push({ x: point.x, y: point.y });
      });
    } else if (lastChart && edge.source && edge.target && edge.source.key !== edge.target.key) {
      var boxes = currentObstacleBoxes(lastChart);
      var routed = routeAroundObstacles(
        start,
        end,
        entry.from,
        entry.to,
        edge.source.key,
        edge.target.key,
        boxes,
        null
      );
      if (routed && routed.length) {
        routed.forEach(function (point) {
          points.push({ x: point.x, y: point.y });
        });
      } else {
        defaultEdgeElbows(start, end, entry.from, entry.to).forEach(function (point) {
          points.push(point);
        });
      }
    } else {
      defaultEdgeElbows(start, end, entry.from, entry.to).forEach(function (point) {
        points.push(point);
      });
    }
    points.push(end);

    var cleaned = cleanEdgePoints(orthogonalizePoints(points));

    var first = cleaned[0];
    var lastPoint = cleaned[cleaned.length - 1];
    if (Math.abs(first.x - lastPoint.x) < 0.5 && Math.abs(first.y - lastPoint.y) < 0.5) {
      var normal = { x: 0, y: 1 };
      if (entry.from === 'top') normal = { x: 0, y: -1 };
      else if (entry.from === 'left') normal = { x: -1, y: 0 };
      else if (entry.from === 'right') normal = { x: 1, y: 0 };

      var perpendicular = { x: -normal.y, y: normal.x };
      cleaned = [
        { x: first.x, y: first.y },
        {
          x: first.x + normal.x * 40 + perpendicular.x * 30,
          y: first.y + normal.y * 40 + perpendicular.y * 30
        },
        {
          x: first.x + normal.x * 40 - perpendicular.x * 30,
          y: first.y + normal.y * 40 - perpendicular.y * 30
        },
        { x: lastPoint.x, y: lastPoint.y }
      ];
    }

    return cleanEdgePoints(orthogonalizePoints(cleaned));
  }

  function normalizeEdgeEntry(edge, entry, snapTol) {
    if (!edge || !entry) return false;

    var points = [edgePortPoint(edge.source, entry.from)];
    (entry.points || []).forEach(function (point) {
      points.push({ x: point.x, y: point.y });
    });
    points.push(edgePortPoint(edge.target, entry.to));

    var interior = compactOrthogonalPoints(orthogonalizePoints(points), snapTol).slice(1, -1).map(function (point) {
      return { x: roundCoord(point.x), y: roundCoord(point.y) };
    });

    var previous = entry.points || [];
    if (interior.length === previous.length) {
      var same = true;
      for (var i = 0; i < interior.length; i++) {
        if (Math.abs(interior[i].x - previous[i].x) > 0.01 || Math.abs(interior[i].y - previous[i].y) > 0.01) {
          same = false;
          break;
        }
      }
      if (same) return false;
    }

    entry.points = interior;
    entry.manual = true;
    return true;
  }

  function segmentIntersectsBox(x1, y1, x2, y2, box) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var t0 = 0;
    var t1 = 1;

    function clip(p, q) {
      if (Math.abs(p) < 1e-9) return q >= 0;
      var r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    }

    return clip(-dx, x1 - box.minX) &&
           clip(dx, box.maxX - x1) &&
           clip(-dy, y1 - box.minY) &&
           clip(dy, box.maxY - y1);
  }

  function positionEdgeLabel(edge, points, collisionSegments, obstacles) {
    if (!edge.label || !edge.label.node || !points || points.length < 2) return;

    var box;
    try { box = edge.label.getBBox(); } catch { return; }
    if (!box || box.width < 0.5 || box.height < 0.5) return;

    var segments = [];
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1];
      var b = points[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.5) continue;
      segments.push({ a: a, b: b, dx: dx, dy: dy, length: length });
    }

    if (!segments.length) return;
    segments.sort(function (first, second) { return second.length - first.length; });

    var blockers = collisionSegments && collisionSegments.length ? collisionSegments : segments;
    var nodeBoxes = Array.isArray(obstacles) ? obstacles : [];

    var oldX = Number(edge.label.attr('x'));
    var oldY = Number(edge.label.attr('y'));
    if (!isFinite(oldX)) oldX = 0;
    if (!isFinite(oldY)) oldY = 0;

    var halfWidth = box.width / 2;
    var halfHeight = box.height / 2;
    var centerOffsetX = (box.x - oldX) + halfWidth;
    var centerOffsetY = (box.y - oldY) + halfHeight;

    var lineWidth = Math.max(1, Number(state.style.lineWidth) || 3);
    var userGap = Math.max(4, Number(state.style.textMargin) || 10);
    var safeGap = Math.max(userGap, lineWidth / 2 + 3);
    var clearance = lineWidth / 2 + 2;
    var candidates = [];
    var ratios = [0.5, 0.35, 0.65];
    var offsetFactors = [1, 1.8];

    segments.slice(0, 4).forEach(function (segment) {
      var nx = -segment.dy / segment.length;
      var ny = segment.dx / segment.length;
      var support = Math.abs(nx) * halfWidth + Math.abs(ny) * halfHeight;
      var offset = support + safeGap;

      ratios.forEach(function (ratio) {
        var px = segment.a.x + segment.dx * ratio;
        var py = segment.a.y + segment.dy * ratio;

        offsetFactors.forEach(function (factor) {
          [1, -1].forEach(function (sign) {
            var centerX = px + nx * offset * factor * sign;
            var centerY = py + ny * offset * factor * sign;
            candidates.push({
              x: centerX - centerOffsetX,
              y: centerY - centerOffsetY,
              box: {
                minX: centerX - halfWidth,
                minY: centerY - halfHeight,
                maxX: centerX + halfWidth,
                maxY: centerY + halfHeight
              }
            });
          });
        });
      });
    });

    function collides(candidate) {
      var expanded = {
        minX: candidate.box.minX - clearance,
        minY: candidate.box.minY - clearance,
        maxX: candidate.box.maxX + clearance,
        maxY: candidate.box.maxY + clearance
      };

      for (var index = 0; index < blockers.length; index++) {
        var segment = blockers[index];
        if (segmentIntersectsBox(segment.a.x, segment.a.y, segment.b.x, segment.b.y, expanded)) {
          return true;
        }
      }

      for (var boxIndex = 0; boxIndex < nodeBoxes.length; boxIndex++) {
        var nodeBox = nodeBoxes[boxIndex];
        if (expanded.minX < nodeBox.x + nodeBox.width &&
            expanded.maxX > nodeBox.x &&
            expanded.minY < nodeBox.y + nodeBox.height &&
            expanded.maxY > nodeBox.y) {
          return true;
        }
      }

      return false;
    }

    var chosen = null;
    for (var index = 0; index < candidates.length; index++) {
      if (!collides(candidates[index])) {
        chosen = candidates[index];
        break;
      }
    }
    if (!chosen) chosen = candidates[0];

    edge.label.attr({
      x: roundCoord(chosen.x),
      y: roundCoord(chosen.y)
    });
  }

  function edgeFacingStraightPoints(edge, entry) {
    if (edge && edge._skipStraight) return null;
    return edgeStraightGeometry(edge, entry);
  }

  function edgeStraightGeometry(edge, entry) {
    if (!edge || !edge.source || !edge.target || edge.source === edge.target) return null;

    var from = entry ? entry.from : '';
    var to = entry ? entry.to : '';

    if (!entry) {
      var pathPoints = readPathPoints(edge.path);
      if (pathPoints.length < 2) return null;
      from = edgeNearestSide(edge.source, pathPoints[0]);
      to = edgeNearestSide(edge.target, pathPoints[pathPoints.length - 1]);
    }

    var facing = (from === 'right' && to === 'left') || (from === 'left' && to === 'right') ||
                 (from === 'bottom' && to === 'top') || (from === 'top' && to === 'bottom');
    if (!facing) return null;

    if (entry && entry.manual && entry.points && entry.points.length) return null;

    var start = edgePortPoint(edge.source, from);
    var end = edgePortPoint(edge.target, to);
    var tolerance = 1;

    if ((from === 'left' || from === 'right') && Math.abs(start.y - end.y) <= tolerance) {
      if (Math.abs(start.x - end.x) < 1) return null;
      return { start: start, end: end };
    }

    if ((from === 'top' || from === 'bottom') && Math.abs(start.x - end.x) <= tolerance) {
      if (Math.abs(start.y - end.y) < 1) return null;
      return { start: start, end: end };
    }

    return null;
  }

  function normalizeAlignedEdge(edge, entry) {
    var straight = edgeFacingStraightPoints(edge, entry);
    if (!straight) return false;

    var commands = [
      ['M', roundCoord(straight.start.x), roundCoord(straight.start.y)],
      ['L', roundCoord(straight.end.x), roundCoord(straight.end.y)]
    ];

    try {
      edge.path.attr('path', commands);
    } catch {
      return false;
    }

    positionEdgeLabel(edge, [straight.start, straight.end]);
    scheduleLineJumps();
    return true;
  }

  function prepareEdgeEntryForEdit(edge, entry) {
    if (!entry || !entry.points || !entry.points.length) return;
    if (edgeFacingStraightPoints(edge, entry)) entry.points = [];
  }

  function applyEdgeGeometry(edge, entry) {
    var points = edgeGeometryPoints(edge, entry);
    var commands = points.map(function (point, index) {
      return [index === 0 ? 'M' : 'L', roundCoord(point.x), roundCoord(point.y)];
    });

    try {
      edge.path.attr('path', commands);
    } catch {
      return;
    }

    edge.path.node.setAttribute('data-edge-overridden', '');
    positionEdgeLabel(edge, points);
    drawEdgeArrow(edge);
    scheduleLineJumps();
  }

  /* ---------------------------------------------------------------------- */
  /* Line jumps (bridge arcs)                                               */
  /* ---------------------------------------------------------------------- */

  /*
   * Crossings get a small arc in the rendered d attribute. The logical path
   * stays a polyline, so hit-testing, labels, and editing are unaffected.
   */
  var lineJumpQueued = false;

  function scheduleLineJumps() {
    if (lineJumpQueued) return;
    lineJumpQueued = true;
    Promise.resolve().then(function () {
      if (!lineJumpQueued) return;
      applyLineJumps();
    });
  }

  function lineJumpBasePoints(node) {
    var d = node.getAttribute('d') || '';
    if (node._plotterJumpD && d === node._plotterJumpD) {
      d = node._plotterBaseD || '';
    } else {
      node._plotterBaseD = d;
      node._plotterJumpD = null;
    }

    var points = [];
    if (!d || typeof Raphael === 'undefined' || !Raphael.path2curve) return points;
    try {
      Raphael.path2curve(d).forEach(function (command) {
        var point = null;
        if (command[0] === 'M') point = { x: Number(command[1]), y: Number(command[2]) };
        else if (command[0] === 'C') point = { x: Number(command[5]), y: Number(command[6]) };
        if (!point || !isFinite(point.x) || !isFinite(point.y)) return;
        var last = points[points.length - 1];
        if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) return;
        points.push(point);
      });
    } catch {
      return [];
    }
    return points;
  }

  function lineJumpCrossing(s, t) {
    var denom = s.dx * t.dy - s.dy * t.dx;
    /* Ignore parallel or shallow crossings. */
    if (Math.abs(denom) < 0.25 * s.len * t.len) return null;
    var ox = t.a.x - s.a.x;
    var oy = t.a.y - s.a.y;
    var ts = (ox * t.dy - oy * t.dx) / denom;
    var tt = (ox * s.dy - oy * s.dx) / denom;
    if (ts <= 0 || ts >= 1 || tt <= 0 || tt >= 1) return null;
    return { s: ts * s.len, t: tt * t.len };
  }

  function formatJumpPoint(point) {
    return roundCoord(point.x) + ',' + roundCoord(point.y);
  }

  function applyLineJumps() {
    lineJumpQueued = false;

    var enabled = state.style.jumps !== false;
    var radius = Math.max(4, (Number(state.style.lineWidth) || 3) * 1.5 + 2);
    var segments = [];

    var paths = currentEdges.filter(function (edge) {
      return edge.path && edge.path.node && edge.path.node.parentNode;
    }).map(function (edge, edgeIndex) {
      var node = edge.path.node;
      var points = lineJumpBasePoints(node);
      var segs = [];
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1];
        var b = points[i];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) {
          segs.push(null);
          continue;
        }
        var seg = {
          edge: edgeIndex, a: a, b: b, dx: dx, dy: dy, len: len,
          horizontal: Math.abs(dx) >= Math.abs(dy),
          minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
          minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
          jumps: []
        };
        segs.push(seg);
        segments.push(seg);
      }
      return { node: node, points: points, segs: segs };
    });

    if (enabled) {
      for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        for (var j = i + 1; j < segments.length; j++) {
          var t = segments[j];
          if (s.edge === t.edge) continue;
          if (s.maxX < t.minX || t.maxX < s.minX || s.maxY < t.minY || t.maxY < s.minY) continue;

          var hit = lineJumpCrossing(s, t);
          if (!hit) continue;

          /* Horizontal runs jump; vertical runs pass under. */
          var jumperIsS = s.horizontal !== t.horizontal ? s.horizontal : false;
          var jumper = jumperIsS ? s : t;
          var other = jumperIsS ? t : s;
          var along = jumperIsS ? hit.s : hit.t;
          var otherAlong = jumperIsS ? hit.t : hit.s;

          if (along < radius + 2 || jumper.len - along < radius + 2) continue;
          if (otherAlong < 2 || other.len - otherAlong < 2) continue;
          jumper.jumps.push(along);
        }
      }
    }

    paths.forEach(function (info) {
      var node = info.node;
      var hasJumps = info.segs.some(function (seg) { return seg && seg.jumps.length; });

      if (!hasJumps) {
        if (node._plotterJumpD) {
          node.setAttribute('d', node._plotterBaseD || '');
          node._plotterJumpD = null;
        }
        return;
      }

      var parts = ['M' + formatJumpPoint(info.points[0])];
      info.segs.forEach(function (seg, index) {
        var end = info.points[index + 1];
        if (!seg || !seg.jumps.length) {
          parts.push('L' + formatJumpPoint(end));
          return;
        }

        var ux = seg.dx / seg.len;
        var uy = seg.dy / seg.len;
        var leftX = uy;
        var leftY = -ux;
        var useLeft = leftX * -0.3 + leftY * -1 >= 0;
        var nx = useLeft ? leftX : -leftX;
        var ny = useLeft ? leftY : -leftY;
        var sweep = useLeft ? 1 : 0;

        var spans = [];
        seg.jumps.slice().sort(function (a, b) { return a - b; }).forEach(function (dist) {
          var lo = dist - radius;
          var hi = dist + radius;
          var last = spans[spans.length - 1];
          if (last && lo <= last.hi + 2) last.hi = Math.max(last.hi, hi);
          else spans.push({ lo: lo, hi: hi });
        });

        function at(dist, lift) {
          return { x: seg.a.x + ux * dist + nx * lift, y: seg.a.y + uy * dist + ny * lift };
        }

        var r = roundCoord(radius);
        spans.forEach(function (span) {
          parts.push('L' + formatJumpPoint(at(span.lo, 0)));
          parts.push('A' + r + ',' + r + ' 0 0 ' + sweep + ' ' + formatJumpPoint(at(span.lo + radius, radius)));
          if (span.hi - span.lo > radius * 2 + 0.05) {
            parts.push('L' + formatJumpPoint(at(span.hi - radius, radius)));
          }
          parts.push('A' + r + ',' + r + ' 0 0 ' + sweep + ' ' + formatJumpPoint(at(span.hi, 0)));
        });
        parts.push('L' + formatJumpPoint(end));
      });

      var d = parts.join(' ');
      node.setAttribute('d', d);
      node._plotterJumpD = node.getAttribute('d');
    });
  }

  function findEdgeByUid(uid) {
    for (var i = 0; i < currentEdges.length; i++) {
      if (currentEdges[i].uid === uid) return currentEdges[i];
    }
    return null;
  }

  function findCurrentEdge() {
    for (var i = 0; i < currentEdges.length; i++) {
      if (currentEdges[i].key === selectedEdgeKey) return currentEdges[i];
    }
    return null;
  }

  function hideEdgeToolbar() {
    if (el.edgeToolbar) el.edgeToolbar.hidden = true;
  }

  function clearEdgeLayers(chart) {
    var svg = chart && chart.diagram && chart.diagram.paper && chart.diagram.paper.canvas;
    if (svg) {
      Array.prototype.slice.call(svg.querySelectorAll('[data-edge-hit], [data-edge-ui], [data-port-ui], [data-connect-preview]')).forEach(function (node) {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
    }
    hideEdgeToolbar();
  }

  function clearEdgeUiElements() {
    if (!lastSvg) return;
    var ui = lastSvg.querySelector('[data-edge-ui]');
    if (!ui) return;
    while (ui.firstChild) ui.removeChild(ui.firstChild);
  }

  function symbolNearPoint(chart, point, pad) {
    if (!chart || !point) return null;
    var exact = symbolAt(chart, point);
    if (exact) return exact;
    var margin = pad != null ? pad : 14;
    var symbols = diagramSymbols(chart);
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < symbols.length; i++) {
      var box = symbolBox(symbols[i]);
      if (!box) continue;
      if (point.x >= box.left - margin && point.x <= box.right + margin &&
          point.y >= box.top - margin && point.y <= box.bottom + margin) {
        var dx = point.x - box.cx;
        var dy = point.y - box.cy;
        var dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = symbols[i];
        }
      }
    }
    return best;
  }

  function canNodeInitiateEdge(symbol) {
    if (!symbol || !symbol.key) return false;
    var sType = String(symbol.symbolType || '').toLowerCase();
    if (sType === 'end') return false;
    return true;
  }

  function pickAvailableBranchForSymbol(symbol, preferredSide) {
    if (!symbol || !symbol.key) return null;
    var sType = String(symbol.symbolType || '').toLowerCase();
    if (sType === 'end') return null;

    var used = {};
    currentEdges.forEach(function (edge) {
      if (edge.source && edge.source.key === symbol.key) {
        used[edge.branch] = edge;
      }
    });

    if (sType === 'condition') {
      if (preferredSide === 'right' || preferredSide === 'left') {
        if (!used.no) return { branch: 'no', replace: false };
        if (!used.yes) return { branch: 'yes', replace: false };
      } else {
        if (!used.yes) return { branch: 'yes', replace: false };
        if (!used.no) return { branch: 'no', replace: false };
      }
      return {
        branch: (preferredSide === 'right' || preferredSide === 'left') ? 'no' : 'yes',
        replace: true,
        oldTarget: used[(preferredSide === 'right' || preferredSide === 'left') ? 'no' : 'yes'].target.key
      };
    }

    if (sType === 'parallel') {
      if (!used.path1) return { branch: 'path1', replace: false };
      if (!used.path2) return { branch: 'path2', replace: false };
      if (!used.path3) return { branch: 'path3', replace: false };
      return { branch: 'path1', replace: true, oldTarget: used.path1.target.key };
    }

    if (!used.next) return { branch: 'next', replace: false };
    return { branch: 'next', replace: true, oldTarget: used.next.target.key };
  }

  /* ---------------------------------------------------------------------- */
  /* DSL source sync                                                        */
  /* ---------------------------------------------------------------------- */

  function parseFlowStepToken(rawToken) {
    var trimmed = String(rawToken || '').trim();
    var openIdx = trimmed.indexOf('(');
    var head = openIdx >= 0 ? trimmed.slice(0, openIdx).trim() : trimmed;
    var argsText = '';
    if (openIdx >= 0 && trimmed.slice(-1) === ')') {
      argsText = trimmed.slice(openIdx + 1, -1);
    }
    var atIdx = head.indexOf('@');
    var key = (atIdx >= 0 ? head.slice(0, atIdx) : head).trim();
    var annotation = atIdx >= 0 ? head.slice(atIdx) : '';
    var args = argsText ? argsText.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

    var branch = 'next';
    var direction = '';
    args.forEach(function (arg) {
      var low = arg.toLowerCase();
      if (low === 'yes' || low === 'no' || low === 'path1' || low === 'path2' || low === 'path3') {
        branch = low;
      } else if (EDGE_SIDE_SET[low]) {
        direction = low;
      }
    });

    return {
      raw: trimmed,
      key: key,
      annotation: annotation,
      branch: branch,
      direction: direction
    };
  }

  function formatFlowStepToken(key, branch, direction, annotation) {
    var out = key + (annotation || '');
    var args = [];
    if (branch && branch !== 'next') args.push(branch);
    if (direction && EDGE_SIDE_SET[direction]) args.push(direction);
    if (args.length) out += '(' + args.join(', ') + ')';
    return out;
  }

  function stripFlowStepOutput(rawToken) {
    var parsed = parseFlowStepToken(rawToken);
    return parsed.key;
  }

  function removeEdgeFromSource(source, fromKey, branch, toKey) {
    var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    var outLines = [];
    var removed = false;
    var targetBranch = branch || 'next';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed || trimmed.indexOf('//') === 0 || trimmed.indexOf('#') === 0 ||
          trimmed.indexOf('=>') !== -1 || trimmed.indexOf('->') === -1 || trimmed.indexOf(':>') !== -1) {
        outLines.push(line);
        continue;
      }

      var indentMatch = /^[ \t]*/.exec(line);
      var indent = indentMatch ? indentMatch[0] : '';
      var rawSteps = trimmed.split('->');
      var steps = rawSteps.map(parseFlowStepToken);

      var matchIndices = [];
      for (var s = 0; s < steps.length - 1; s++) {
        var cur = steps[s];
        var nxt = steps[s + 1];
        if (cur.key === fromKey && nxt.key === toKey &&
            (cur.branch === targetBranch || (!targetBranch && cur.branch === 'next'))) {
          matchIndices.push(s);
        }
      }

      if (!matchIndices.length) {
        outLines.push(line);
        continue;
      }

      removed = true;
      var currentChain = [rawSteps[0].trim()];
      for (var k = 0; k < steps.length - 1; k++) {
        if (matchIndices.indexOf(k) !== -1) {
          if (currentChain.length >= 2) {
            currentChain[currentChain.length - 1] = stripFlowStepOutput(currentChain[currentChain.length - 1]);
            outLines.push(indent + currentChain.join('->'));
          }
          currentChain = [rawSteps[k + 1].trim()];
        } else {
          currentChain.push(rawSteps[k + 1].trim());
        }
      }
      if (currentChain.length >= 2) {
        currentChain[currentChain.length - 1] = stripFlowStepOutput(currentChain[currentChain.length - 1]);
        outLines.push(indent + currentChain.join('->'));
      }
    }

    return { source: outLines.join('\n'), changed: removed };
  }

  function reconnectEdgeInSource(source, fromKey, branch, oldToKey, newToKey, newFromKey, fromDir) {
    var targetBranch = branch || 'next';

    if (!newFromKey || newFromKey === fromKey) {
      var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
      var outLines = [];
      var updated = false;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (updated || !trimmed || trimmed.indexOf('//') === 0 || trimmed.indexOf('#') === 0 ||
            trimmed.indexOf('=>') !== -1 || trimmed.indexOf('->') === -1 || trimmed.indexOf(':>') !== -1) {
          outLines.push(line);
          continue;
        }

        var indent = (/^[ \t]*/.exec(line) || [''])[0];
        var rawSteps = trimmed.split('->');
        var steps = rawSteps.map(parseFlowStepToken);
        var hitIdx = -1;

        for (var s = 0; s < steps.length - 1; s++) {
          if (steps[s].key === fromKey && steps[s + 1].key === oldToKey &&
              (steps[s].branch === targetBranch || (!targetBranch && steps[s].branch === 'next'))) {
            hitIdx = s;
            break;
          }
        }

        if (hitIdx === -1) {
          outLines.push(line);
          continue;
        }

        updated = true;
        var updatedFromToken = formatFlowStepToken(
          fromKey,
          steps[hitIdx].branch,
          fromDir || steps[hitIdx].direction,
          steps[hitIdx].annotation
        );

        if (hitIdx === steps.length - 2) {
          rawSteps[hitIdx] = updatedFromToken;
          rawSteps[hitIdx + 1] = newToKey;
          outLines.push(indent + rawSteps.map(function (t) { return t.trim(); }).join('->'));
        } else {
          var headChain = rawSteps.slice(0, hitIdx).map(function (t) { return t.trim(); });
          headChain.push(updatedFromToken, newToKey);
          outLines.push(indent + headChain.join('->'));

          var tailChain = rawSteps.slice(hitIdx + 1).map(function (t) { return t.trim(); });
          if (tailChain.length >= 2) {
            outLines.push(indent + tailChain.join('->'));
          }
        }
      }

      return { source: outLines.join('\n'), changed: updated };
    }

    var rem = removeEdgeFromSource(source, fromKey, targetBranch, oldToKey);
    var added = addEdgeToSource(rem.source, newFromKey, targetBranch, newToKey, fromDir);
    return { source: added.source, changed: rem.changed || added.changed };
  }

  function addEdgeToSource(source, fromKey, branch, toKey, fromDir) {
    var cleanDir = (fromDir && fromDir !== 'bottom') ? fromDir : '';
    var stepToken = formatFlowStepToken(fromKey, branch || 'next', cleanDir, '');
    var newLine = stepToken + '->' + toKey;
    var text = String(source || '').replace(/\r\n?/g, '\n');
    var trimmedEnd = text.replace(/\s+$/, '');
    var nextSource = trimmedEnd ? (trimmedEnd + '\n' + newLine + '\n') : (newLine + '\n');
    return { source: nextSource, changed: true };
  }

  function commitCanvasSourceMutation(nextSource, historySnapshot, message) {
    suppressNextInputHistory = true;
    reconcileHiddenEdges(state.source, nextSource);
    state.source = nextSource;
    el.editor.value = state.source;
    trackedNodes = extractDefinedNodes(state.source).filter(function (n) { return !n.incomplete && n.key; });
    refreshEditor();
    clearTimeout(renderTimer);
    renderNow({ animate: false });
    pushHistorySnapshot(historySnapshot);
    lastCommittedSnapshot = captureSnapshot();
    markSaving();
    syncLayoutButton();
    if (message) toast(message, '撤销', undoManual);
  }

  function edgeSelectionPoints(edge) {
    var entry = findEdgeOverride(edge);
    var straight = edgeFacingStraightPoints(edge, entry);
    if (straight) return [straight.start, straight.end];

    if (entry) {
      if (!entry.points || !entry.points.length) {
        return cleanEdgePoints(edgeGeometryPoints(edge, entry));
      }

      var overridePoints = [edgePortPoint(edge.source, entry.from)];
      entry.points.forEach(function (point) {
        overridePoints.push({ x: point.x, y: point.y });
      });
      overridePoints.push(edgePortPoint(edge.target, entry.to));
      return overridePoints;
    }

    var points = readPathPoints(edge.path);
    if (points.length < 2) {
      points = [edgePortPoint(edge.source, 'bottom'), edgePortPoint(edge.target, 'top')];
    }
    return points;
  }

  function addEdgeHandle(ui, edge, type, index, point) {
    var group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-edge-handle', type);
    group.setAttribute('data-edge-uid', edge.uid);
    if (index >= 0) group.setAttribute('data-edge-point', String(index));

    var hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('cx', String(roundCoord(point.x)));
    hit.setAttribute('cy', String(roundCoord(point.y)));
    hit.setAttribute('r', String(14 / zoom));
    hit.setAttribute('data-base-r', '14');
    hit.setAttribute('fill', 'rgba(0,0,0,0)');
    hit.setAttribute('pointer-events', 'all');
    group.appendChild(hit);

    var dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(roundCoord(point.x)));
    dot.setAttribute('cy', String(roundCoord(point.y)));
    dot.setAttribute('r', String(7 / zoom));
    dot.setAttribute('data-base-r', '7');
    dot.setAttribute('fill', '#ffffff');
    dot.setAttribute('stroke', '#e4572e');
    dot.setAttribute('stroke-width', String(2 / zoom));
    dot.setAttribute('data-base-stroke', '2');
    dot.setAttribute('pointer-events', 'none');
    group.appendChild(dot);

    var title = document.createElementNS(SVG_NS, 'title');
    title.textContent = type === 'point'
      ? '拖动平移折角，双击或右键删除折点'
      : '拖动切换节点接入方向，或拖到其他节点改接连线';
    group.appendChild(title);

    ui.appendChild(group);
  }

  function drawEdgeSelection(edge) {
    if (!lastSvg || !edge) return;

    var ui = lastSvg.querySelector('[data-edge-ui]');
    if (!ui) {
      ui = document.createElementNS(SVG_NS, 'g');
      ui.setAttribute('data-edge-ui', '');
      lastSvg.appendChild(ui);
    }
    while (ui.firstChild) ui.removeChild(ui.firstChild);

    var lineWidth = Number(state.style.lineWidth) || 3;
    var highlight = document.createElementNS(SVG_NS, 'path');
    highlight.setAttribute('d', edge.path.node.getAttribute('d') || '');
    highlight.setAttribute('fill', 'none');
    highlight.setAttribute('stroke', '#e4572e');
    highlight.setAttribute('stroke-width', String(lineWidth + 6));
    highlight.setAttribute('stroke-opacity', '0.28');
    highlight.setAttribute('pointer-events', 'none');
    ui.appendChild(highlight);

    var points = edgeSelectionPoints(edge);
    var lastIndex = points.length - 1;

    addEdgeHandle(ui, edge, 'from', -1, points[0]);
    addEdgeHandle(ui, edge, 'to', -1, points[lastIndex]);

    for (var i = 1; i < lastIndex; i++) {
      addEdgeHandle(ui, edge, 'point', i - 1, points[i]);
    }

    showEdgeToolbar();
  }

  function setEdgeSelected(edge) {
    if (!edge) {
      clearEdgeSelection();
      return;
    }

    clearNodeSelection();

    if (selectedEdgeKey !== edge.key && !edgeHintShown) {
      edgeHintShown = true;
      toast('提示：拖动线段或折角可正交平移；工具条可切换起点/终点接口；删除连线只影响图纸，不改源码。');
    }
    if (selectedEdgeKey !== edge.key) lastLineClick = null;

    selectedEdgeKey = edge.key;
    drawEdgeSelection(edge);
  }

  function clearEdgeSelection() {
    selectedEdgeKey = '';
    lastPointClick = null;
    lastLineClick = null;
    clearEdgeUiElements();
    hideEdgeToolbar();
  }

  function restoreEdgeSelection() {
    if (!selectedEdgeKey) {
      hideEdgeToolbar();
      return;
    }

    var edge = findCurrentEdge();
    if (!edge) {
      clearEdgeSelection();
      return;
    }
    drawEdgeSelection(edge);
  }

  function drawNodePortHandles() {
    if (!lastSvg || !lastChart) return;
    var portLayer = lastSvg.querySelector('[data-port-ui]');
    if (!portLayer) {
      portLayer = document.createElementNS(SVG_NS, 'g');
      portLayer.setAttribute('data-port-ui', '');
      var edgeUi = lastSvg.querySelector('[data-edge-ui]');
      lastSvg.insertBefore(portLayer, edgeUi || null);
    }
    while (portLayer.firstChild) portLayer.removeChild(portLayer.firstChild);

    if (edgeDrag || nodeDrag || el.sheet.dataset.stale === 'true') return;

    var activeKeys = [];
    if (selectedNodeKeys.length === 1) activeKeys.push(selectedNodeKeys[0]);
    if (hoveredNodeKey && activeKeys.indexOf(hoveredNodeKey) === -1) activeKeys.push(hoveredNodeKey);

    activeKeys.forEach(function (key) {
      var symbol = symbolByKey(lastChart, key);
      if (!symbol || !canNodeInitiateEdge(symbol)) return;

      EDGE_SIDES.forEach(function (side) {
        var pt = edgePortPoint(symbol, side);
        var g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('data-node-port', side);
        g.setAttribute('data-port-node', key);

        var hit = document.createElementNS(SVG_NS, 'circle');
        hit.setAttribute('cx', String(roundCoord(pt.x)));
        hit.setAttribute('cy', String(roundCoord(pt.y)));
        hit.setAttribute('r', String(10 / zoom));
        hit.setAttribute('data-base-r', '10');
        hit.setAttribute('fill', 'rgba(0,0,0,0)');
        hit.setAttribute('pointer-events', 'all');
        g.appendChild(hit);

        var dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', String(roundCoord(pt.x)));
        dot.setAttribute('cy', String(roundCoord(pt.y)));
        dot.setAttribute('r', String(4.8 / zoom));
        dot.setAttribute('data-base-r', '4.8');
        dot.setAttribute('fill', '#ffffff');
        dot.setAttribute('stroke', '#e4572e');
        dot.setAttribute('stroke-width', String(1.8 / zoom));
        dot.setAttribute('data-base-stroke', '1.8');
        dot.setAttribute('pointer-events', 'none');
        g.appendChild(dot);

        var title = document.createElementNS(SVG_NS, 'title');
        title.textContent = '从此处拖拽连接到其他节点';
        g.appendChild(title);

        portLayer.appendChild(g);
      });
    });
  }

  function beginConnectDrag(event) {
    if (!lastChart || !lastSvg) return false;
    if (el.sheet.dataset.stale === 'true') return false;

    var portEl = event.target.closest('[data-node-port]');
    if (!portEl) return false;

    var fromKey = portEl.getAttribute('data-port-node');
    var fromSide = portEl.getAttribute('data-node-port') || 'bottom';
    var sourceSymbol = symbolByKey(lastChart, fromKey);
    if (!sourceSymbol || !canNodeInitiateEdge(sourceSymbol)) return false;

    event.preventDefault();
    clearEdgeSelection();

    var startPt = edgePortPoint(sourceSymbol, fromSide);
    try { el.viewport.setPointerCapture(event.pointerId); } catch { /* ignore */ }

    var previewLayer = lastSvg.querySelector('[data-connect-preview]');
    if (!previewLayer) {
      previewLayer = document.createElementNS(SVG_NS, 'g');
      previewLayer.setAttribute('data-connect-preview', '');
      previewLayer.setAttribute('pointer-events', 'none');
      lastSvg.appendChild(previewLayer);
    }
    while (previewLayer.firstChild) previewLayer.removeChild(previewLayer.firstChild);

    var pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', '#e4572e');
    pathEl.setAttribute('stroke-width', String(Math.max(2, Number(state.style.lineWidth) || 3)));
    pathEl.setAttribute('stroke-dasharray', '6 4');
    pathEl.setAttribute('d', 'M' + roundCoord(startPt.x) + ',' + roundCoord(startPt.y) + ' L' + roundCoord(startPt.x) + ',' + roundCoord(startPt.y));
    previewLayer.appendChild(pathEl);

    var targetHighlight = document.createElementNS(SVG_NS, 'rect');
    targetHighlight.setAttribute('fill', 'rgba(228, 87, 46, 0.08)');
    targetHighlight.setAttribute('stroke', '#e4572e');
    targetHighlight.setAttribute('stroke-width', String(1.5 / zoom));
    targetHighlight.setAttribute('rx', String(3 / zoom));
    targetHighlight.setAttribute('visibility', 'hidden');
    previewLayer.appendChild(targetHighlight);

    connectDrag = {
      pointerId: event.pointerId,
      sourceSymbol: sourceSymbol,
      fromKey: fromKey,
      fromSide: fromSide,
      startPt: startPt,
      targetSymbol: null,
      toSide: 'top',
      pathEl: pathEl,
      targetHighlight: targetHighlight,
      previewLayer: previewLayer
    };

    el.viewport.classList.add('dragging-connect');
    return true;
  }

  function moveConnectDrag(event) {
    if (!connectDrag || !lastSvg || !lastChart) return;
    if (event.pointerId !== connectDrag.pointerId) return;

    var pt = clientToUser(lastSvg, event.clientX, event.clientY);
    if (!pt) return;

    var hitSymbol = symbolNearPoint(lastChart, pt, 14);
    if (hitSymbol && hitSymbol.key === connectDrag.fromKey) hitSymbol = null;

    connectDrag.targetSymbol = hitSymbol;
    var endPt = pt;
    var toSide = 'top';

    if (hitSymbol) {
      toSide = edgeNearestSide(hitSymbol, pt);
      connectDrag.toSide = toSide;
      endPt = edgePortPoint(hitSymbol, toSide);
      var box = symbolBox(hitSymbol);
      if (box) {
        connectDrag.targetHighlight.setAttribute('x', String(roundCoord(box.left - 4)));
        connectDrag.targetHighlight.setAttribute('y', String(roundCoord(box.top - 4)));
        connectDrag.targetHighlight.setAttribute('width', String(roundCoord(box.w + 8)));
        connectDrag.targetHighlight.setAttribute('height', String(roundCoord(box.h + 8)));
        connectDrag.targetHighlight.setAttribute('visibility', 'visible');
      }
    } else {
      connectDrag.targetHighlight.setAttribute('visibility', 'hidden');
    }

    var elbows = defaultEdgeElbows(connectDrag.startPt, endPt, connectDrag.fromSide, toSide);
    var poly = cleanEdgePoints(orthogonalizePoints([connectDrag.startPt].concat(elbows, [endPt])));
    var d = poly.map(function (p, idx) {
      return (idx === 0 ? 'M' : 'L') + roundCoord(p.x) + ',' + roundCoord(p.y);
    }).join(' ');
    connectDrag.pathEl.setAttribute('d', d);
  }

  function finishConnectDrag(cancelled) {
    if (!connectDrag) return;
    var drag = connectDrag;
    connectDrag = null;

    el.viewport.classList.remove('dragging-connect');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }
    if (drag.previewLayer && drag.previewLayer.parentNode) {
      drag.previewLayer.parentNode.removeChild(drag.previewLayer);
    }

    if (cancelled || !drag.targetSymbol || !drag.targetSymbol.key) {
      drawNodePortHandles();
      return;
    }

    var targetKey = drag.targetSymbol.key;
    var branchSpec = pickAvailableBranchForSymbol(drag.sourceSymbol, drag.fromSide);
    if (!branchSpec) {
      toast('该节点无法新增连出线。', null, null, 'warn');
      return;
    }

    var historySnapshot = captureManualState();
    var result;
    if (branchSpec.replace && branchSpec.oldTarget) {
      result = reconnectEdgeInSource(
        state.source,
        drag.fromKey,
        branchSpec.branch,
        branchSpec.oldTarget,
        targetKey,
        drag.fromKey,
        drag.fromSide
      );
    } else {
      result = addEdgeToSource(state.source, drag.fromKey, branchSpec.branch, targetKey, drag.fromSide);
    }

    var existingEntry = findEdgeEntry(drag.fromKey, branchSpec.branch);
    if (existingEntry) removeEdgeEntry(existingEntry);
    state.edges.push({
      source: drag.fromKey,
      branch: branchSpec.branch,
      target: targetKey,
      from: drag.fromSide,
      to: drag.toSide || 'top',
      points: [],
      manual: false
    });

    selectedEdgeKey = edgeKey(drag.fromKey, branchSpec.branch);
    commitCanvasSourceMutation(
      result.source,
      historySnapshot,
      branchSpec.replace
        ? ('已改接连线：' + drag.fromKey + ' → ' + targetKey)
        : ('已新增连线：' + drag.fromKey + ' → ' + targetKey)
    );
  }

  function abortConnectDrag() {
    if (connectDrag) finishConnectDrag(true);
  }

  function buildEdgeInteractivity(chart) {
    var svg = chart && chart.diagram && chart.diagram.paper && chart.diagram.paper.canvas;
    if (!svg) return;

    clearEdgeLayers(chart);

    var hitLayer = document.createElementNS(SVG_NS, 'g');
    hitLayer.setAttribute('data-edge-hit', '');

    currentEdges.forEach(function (edge) {
      var d = edge.path && edge.path.node ? edge.path.node.getAttribute('d') : '';
      if (!d) return;

      var hitPath = document.createElementNS(SVG_NS, 'path');
      hitPath.setAttribute('d', d);
      hitPath.setAttribute('fill', 'none');
      hitPath.setAttribute('stroke', 'rgba(0,0,0,0)');
      hitPath.setAttribute('stroke-width', String((Number(state.style.lineWidth) || 3) + 14));
      hitPath.setAttribute('pointer-events', 'stroke');
      hitPath.setAttribute('data-edge-uid', edge.uid);
      hitLayer.appendChild(hitPath);
    });

    var uiLayer = document.createElementNS(SVG_NS, 'g');
    uiLayer.setAttribute('data-edge-ui', '');

    var portLayer = document.createElementNS(SVG_NS, 'g');
    portLayer.setAttribute('data-port-ui', '');

    svg.appendChild(hitLayer);
    /* Port anchors sit below edge handles. */
    svg.appendChild(portLayer);
    svg.appendChild(uiLayer);

    edgeUiZoom = 0;
    updateEdgeUiScale();
    restoreEdgeSelection();
    drawNodePortHandles();
  }

  function updateEdgeUiScale() {
    if (!lastSvg || edgeUiZoom === zoom) return;
    edgeUiZoom = zoom;

    var lineWidth = Number(state.style.lineWidth) || 3;
    Array.prototype.slice.call(lastSvg.querySelectorAll('[data-edge-hit] path')).forEach(function (path) {
      path.setAttribute('stroke-width', String((lineWidth + 14) / zoom));
    });

    Array.prototype.slice.call(lastSvg.querySelectorAll('[data-edge-ui] [data-base-r], [data-port-ui] [data-base-r]')).forEach(function (node) {
      node.setAttribute('r', String(Number(node.getAttribute('data-base-r')) / zoom));
      if (node.hasAttribute('data-base-stroke')) {
        node.setAttribute('stroke-width', String(Number(node.getAttribute('data-base-stroke')) / zoom));
      }
    });

    Array.prototype.slice.call(lastSvg.querySelectorAll('[data-node-select] rect')).forEach(function (rect) {
      rect.setAttribute('stroke-width', String(1 / zoom));
      rect.setAttribute('stroke-dasharray', (4 / zoom) + ' ' + (3 / zoom));
    });
  }

  function positionEdgeToolbar() {
    if (!el.edgeToolbar || el.edgeToolbar.hidden || !selectedEdgeKey) return;

    var rect = el.viewport.getBoundingClientRect();
    var width = el.edgeToolbar.offsetWidth || 210;
    var left = Math.round(rect.right - width - 12) + 'px';
    var top = Math.round(rect.top + 12) + 'px';
    if (el.edgeToolbar.style.left !== left) el.edgeToolbar.style.left = left;
    if (el.edgeToolbar.style.top !== top) el.edgeToolbar.style.top = top;
  }

  function currentEdgeSides(edge) {
    if (!edge) return { from: 'bottom', to: 'top' };
    var entry = findEdgeEntry(edge.source.key, edge.branch);
    if (entry && (!entry.target || entry.target === edge.target.key) &&
        EDGE_SIDE_SET[entry.from] && EDGE_SIDE_SET[entry.to]) {
      return { from: entry.from, to: entry.to };
    }
    var points = edgeSelectionPoints(edge);
    if (points.length < 2) return { from: 'bottom', to: 'top' };
    return {
      from: edgeNearestSide(edge.source, points[0]),
      to: edgeNearestSide(edge.target, points[points.length - 1])
    };
  }

  function syncEdgePortControls(edge) {
    if (!el.edgeFromPort || !el.edgeToPort) return;
    var sides = currentEdgeSides(edge);
    el.edgeFromPort.value = sides.from;
    el.edgeToPort.value = sides.to;
    el.edgeFromPort.disabled = !edge;
    el.edgeToPort.disabled = !edge;
  }

  function setEdgePort(end, side) {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再调整。', null, null, 'warn');
      syncEdgePortControls(findCurrentEdge());
      return;
    }
    if (!EDGE_SIDE_SET[side]) return;

    var edge = findCurrentEdge();
    if (!edge) return;

    var sides = currentEdgeSides(edge);
    if (sides[end] === side) return;

    var snapshot = captureManualState();
    var entry = ensureEdgeOverride(edge);
    if (!entry) return;

    entry[end] = side;
    entry.points = [];
    entry.manual = false;
    applyEdgeGeometry(edge, entry);
    normalizeAlignedEdge(edge, entry);
    drawEdgeArrow(edge);
    pushHistorySnapshot(snapshot);
    markSaving();
    syncLayoutButton();
    drawEdgeSelection(edge);
    toast((end === 'from' ? '起点' : '终点') + '已改为' + EDGE_SIDE_LABELS[side] + '侧', '撤销', undoManual);
  }

  function showEdgeToolbar() {
    if (!el.edgeToolbar) return;
    if (el.viewport.getBoundingClientRect().width === 0) {
      el.edgeToolbar.hidden = true;
      return;
    }
    el.edgeToolbar.hidden = false;
    syncEdgePortControls(findCurrentEdge());
    positionEdgeToolbar();
  }

  function projectToPolyline(points, point) {
    var best = null;
    var bestDistance = Infinity;

    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1];
      var b = points[i];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var lengthSq = dx * dx + dy * dy;
      if (lengthSq < 0.0001) continue;

      var t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
      t = clamp(t, 0, 1);
      var px = a.x + dx * t;
      var py = a.y + dy * t;
      var distance = (point.x - px) * (point.x - px) + (point.y - py) * (point.y - py);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = { index: i - 1, point: { x: px, y: py } };
      }
    }

    return best;
  }

  function addEdgeWaypointAt(edge, event) {
    if (!lastSvg) return;

    var point = clientToUser(lastSvg, event.clientX, event.clientY);
    if (!point) return;

    var snapshot = captureManualState();
    var entry = ensureEdgeOverride(edge);
    prepareEdgeEntryForEdit(edge, entry);
    materializeEdgeElbows(edge, entry);

    var raw = [edgePortPoint(edge.source, entry.from)];
    (entry.points || []).forEach(function (item) {
      raw.push({ x: item.x, y: item.y });
    });
    raw.push(edgePortPoint(edge.target, entry.to));

    var projected = projectToPolyline(raw, point);
    if (!projected) return;

    var segIdx = projected.index;
    var pA = raw[segIdx];
    var pB = raw[segIdx + 1];
    var isHoriz = Math.abs(pA.y - pB.y) <= Math.abs(pA.x - pB.x);
    var insertAt = Math.min(segIdx, entry.points.length);
    var ptX = roundCoord(projected.point.x);
    var ptY = roundCoord(projected.point.y);

    if (entry.points.length === 0) {
      var midX = roundCoord((pA.x + pB.x) / 2);
      var midY = roundCoord((pA.y + pB.y) / 2);
      if (isHoriz) {
        entry.points = [{ x: midX, y: roundCoord(pA.y) }, { x: midX, y: roundCoord(pB.y) }];
      } else {
        entry.points = [{ x: roundCoord(pA.x), y: midY }, { x: roundCoord(pB.x), y: midY }];
      }
    } else {
      entry.points.splice(insertAt, 0, { x: ptX, y: ptY });
    }
    entry.manual = true;

    applyEdgeGeometry(edge, entry);
    pushHistorySnapshot(snapshot);
    markSaving();
    syncLayoutButton();
    buildEdgeInteractivity(lastChart);
    suppressEdgeDblclick = true;
    setTimeout(function () { suppressEdgeDblclick = false; }, 500);
    toast('已添加折点', '撤销', undoManual);
  }

  function beginEdgeHandle(event) {
    if (!lastChart || !lastSvg) return false;
    if (el.sheet.dataset.stale === 'true') return false;

    var handle = event.target.closest('[data-edge-handle]');
    if (!handle) return false;
    lastEdgeInteractionAt = Date.now();

    var edge = findEdgeByUid(handle.getAttribute('data-edge-uid'));
    if (!edge) return false;

    var type = handle.getAttribute('data-edge-handle');
    var index = Number(handle.getAttribute('data-edge-point'));

    if (type === 'point') {
      var now = Date.now();
      if (lastPointClick && lastPointClick.uid === edge.uid &&
          lastPointClick.index === index && now - lastPointClick.time < 450) {
        lastPointClick = null;
        suppressEdgeDblclick = true;
        setTimeout(function () { suppressEdgeDblclick = false; }, 500);
        removeEdgeWaypoint(edge.uid, index);
        return true;
      }
      lastPointClick = { uid: edge.uid, index: index, time: now };
    }

    var existing = findEdgeOverride(edge);
    var snapshot = existing ? cloneEdgeEntry(existing) : null;
    var historySnapshot = captureManualState();
    var entry = ensureEdgeOverride(edge);
    prepareEdgeEntryForEdit(edge, entry);
    if (type === 'point' && entry.points.length === 0) {
      materializeEdgeElbows(edge, entry);
    }

    startEdgeDrag(event, edge, entry, type === 'point' ? 'point' : 'endpoint', type, index, snapshot, historySnapshot);
    return true;
  }

  function beginEdgeHit(event) {
    if (!lastChart || !lastSvg) return false;
    if (el.sheet.dataset.stale === 'true') return false;

    var hit = event.target.closest('[data-edge-hit]');
    if (!hit) return false;
    lastEdgeInteractionAt = Date.now();

    var uidNode = event.target.closest('[data-edge-uid]');
    var edge = uidNode ? findEdgeByUid(uidNode.getAttribute('data-edge-uid')) : null;
    if (!edge) return false;

    if (selectedEdgeKey !== edge.key) {
      setEdgeSelected(edge);
      lastLineClick = { key: edge.key, time: Date.now(), x: event.clientX, y: event.clientY };
      return true;
    }

    var now = Date.now();
    if (lastLineClick && lastLineClick.key === edge.key && now - lastLineClick.time < 450 &&
        Math.abs(event.clientX - lastLineClick.x) < 8 && Math.abs(event.clientY - lastLineClick.y) < 8) {
      lastLineClick = null;
      startEdgeDrag(event, edge, null, 'waypoint', '', -1, null, null);
      return true;
    }
    lastLineClick = { key: edge.key, time: now, x: event.clientX, y: event.clientY };

    var existing = findEdgeOverride(edge);
    var snapshot = existing ? cloneEdgeEntry(existing) : null;
    var historySnapshot = captureManualState();
    var entry = ensureEdgeOverride(edge);
    prepareEdgeEntryForEdit(edge, entry);
    startEdgeDrag(event, edge, entry, 'segment', '', -1, snapshot, historySnapshot);
    return true;
  }

  function startEdgeDrag(event, edge, entry, mode, end, index, snapshot, historySnapshot) {
    if (mode === 'segment') event.preventDefault();
    try {
      el.viewport.setPointerCapture(event.pointerId);
    } catch { /* ignore */ }
    if (edgeDragFrame) {
      window.cancelAnimationFrame(edgeDragFrame);
      edgeDragFrame = 0;
    }

    var basePoints = entry && entry.points
      ? entry.points.map(function (p) { return { x: p.x, y: p.y }; })
      : [];

    edgeDrag = {
      edge: edge,
      entry: entry,
      mode: mode,
      end: end,
      index: index,
      basePoints: basePoints,
      reconnectSymbol: null,
      reconnectSide: '',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      startFit: fitMode,
      started: mode === 'point' || mode === 'endpoint',
      dirty: false,
      shiftKey: event.shiftKey,
      snapshot: snapshot,
      historySnapshot: historySnapshot
    };

    fitMode = false;
    el.viewport.classList.add('dragging-edge');
    if (lastSvg) lastSvg.setAttribute('data-dragging', 'true');
  }

  function scheduleEdgeDragFrame() {
    if (edgeDragFrame) return;
    edgeDragFrame = window.requestAnimationFrame(applyEdgeDragFrame);
  }

  function applyEdgeDragFrame() {
    edgeDragFrame = 0;
    if (!edgeDrag || !lastSvg) return;

    var drag = edgeDrag;
    var point = clientToUser(lastSvg, drag.lastClientX, drag.lastClientY);
    if (!point) return;

    if (drag.blocked) return;

    if (drag.mode === 'waypoint') {
      var waypointX = Math.abs(drag.lastClientX - drag.startClientX);
      var waypointY = Math.abs(drag.lastClientY - drag.startClientY);
      if (waypointX < 3 && waypointY < 3) return;

      drag.mode = 'segment';
      drag.started = false;

      if (!drag.entry) {
        var existingEntry = findEdgeOverride(drag.edge);
        drag.snapshot = existingEntry ? cloneEdgeEntry(existingEntry) : null;
        drag.historySnapshot = captureManualState();
        drag.entry = ensureEdgeOverride(drag.edge);
        prepareEdgeEntryForEdit(drag.edge, drag.entry);
      }
    }

    if (drag.mode === 'segment' && !drag.started) {
      var dx = Math.abs(drag.lastClientX - drag.startClientX);
      var dy = Math.abs(drag.lastClientY - drag.startClientY);
      if (dx < 3 && dy < 3) return;

      materializeEdgeElbows(drag.edge, drag.entry);
      var startPoint = clientToUser(lastSvg, drag.startClientX, drag.startClientY) || point;
      var startPort = edgePortPoint(drag.edge.source, drag.entry.from);
      var endPort = edgePortPoint(drag.edge.target, drag.entry.to);
      var raw = [startPort];
      (drag.entry.points || []).forEach(function (item) {
        raw.push({ x: item.x, y: item.y });
      });
      raw.push(endPort);

      var projected = projectToPolyline(raw, startPoint);
      if (!projected) return;

      var segmentIndex = projected.index;
      var totalPts = drag.entry.points.length;

      if (totalPts === 0) {
        var midX = roundCoord((startPort.x + endPort.x) / 2);
        var midY = roundCoord((startPort.y + endPort.y) / 2);
        if (Math.abs(startPort.x - endPort.x) <= Math.abs(startPort.y - endPort.y)) {
          drag.entry.points = [{ x: roundCoord(startPort.x), y: midY }, { x: roundCoord(endPort.x), y: midY }];
        } else {
          drag.entry.points = [{ x: midX, y: roundCoord(startPort.y) }, { x: midX, y: roundCoord(endPort.y) }];
        }
        segmentIndex = 1;
      } else if (segmentIndex === 0) {
        var firstW = drag.entry.points[0];
        drag.entry.points.unshift({ x: roundCoord(startPort.x), y: roundCoord(startPort.y) });
        segmentIndex = 1;
        void firstW;
      } else if (segmentIndex === totalPts) {
        drag.entry.points.push({ x: roundCoord(endPort.x), y: roundCoord(endPort.y) });
      }

      drag.started = true;
      drag.mode = 'translate';
      drag.segmentIndex = segmentIndex;
      drag.pointA = segmentIndex - 1;
      drag.pointB = segmentIndex;
      drag.originA = { x: drag.entry.points[drag.pointA].x, y: drag.entry.points[drag.pointA].y };
      drag.originB = { x: drag.entry.points[drag.pointB].x, y: drag.entry.points[drag.pointB].y };
      drag.startUser = startPoint;
    }

    var snapTolerance = 8;

    if (drag.mode === 'translate') {
      var moveX = point.x - drag.startUser.x;
      var moveY = point.y - drag.startUser.y;
      var segDx = drag.originB.x - drag.originA.x;
      var segDy = drag.originB.y - drag.originA.y;
      var pointA = drag.entry.points[drag.pointA];
      var pointB = drag.entry.points[drag.pointB];
      var sPort = edgePortPoint(drag.edge.source, drag.entry.from);
      var ePort = edgePortPoint(drag.edge.target, drag.entry.to);
      var prevRef = drag.pointA > 0 ? drag.entry.points[drag.pointA - 1] : sPort;
      var nextRef = drag.pointB + 1 < drag.entry.points.length ? drag.entry.points[drag.pointB + 1] : ePort;

      if (Math.abs(segDy) <= Math.abs(segDx)) {
        var newY = roundCoord(drag.originA.y + moveY);
        if (prevRef && Math.abs(newY - prevRef.y) <= snapTolerance) newY = roundCoord(prevRef.y);
        else if (nextRef && Math.abs(newY - nextRef.y) <= snapTolerance) newY = roundCoord(nextRef.y);
        pointA.y = newY;
        pointB.y = newY;
      } else {
        var newX = roundCoord(drag.originA.x + moveX);
        if (prevRef && Math.abs(newX - prevRef.x) <= snapTolerance) newX = roundCoord(prevRef.x);
        else if (nextRef && Math.abs(newX - nextRef.x) <= snapTolerance) newX = roundCoord(nextRef.x);
        pointA.x = newX;
        pointB.x = newX;
      }

      drag.entry.manual = true;
      drag.dirty = true;
    } else if (drag.mode === 'endpoint') {
      var nearSym = symbolNearPoint(lastChart, point, 14);
      var currentEndSymbol = drag.end === 'from' ? drag.edge.source : drag.edge.target;
      var oppositeSymbol = drag.end === 'from' ? drag.edge.target : drag.edge.source;

      if (nearSym && nearSym !== oppositeSymbol && (drag.end === 'to' || canNodeInitiateEdge(nearSym))) {
        var newSide = edgeNearestSide(nearSym, point);
        if (nearSym === currentEndSymbol) {
          drag.reconnectSymbol = null;
          drag.reconnectSide = '';
          if (drag.entry[drag.end] !== newSide) {
            drag.entry[drag.end] = newSide;
            drag.entry.points = [];
            drag.dirty = true;
          }
        } else {
          drag.reconnectSymbol = nearSym;
          drag.reconnectSide = newSide;
          drag.dirty = true;
        }
      } else {
        drag.reconnectSymbol = null;
        drag.reconnectSide = '';
        var fallbackSide = edgeNearestSide(currentEndSymbol, point);
        if (drag.entry[drag.end] !== fallbackSide) {
          drag.entry[drag.end] = fallbackSide;
          drag.entry.points = [];
          drag.dirty = true;
        }
      }
    } else if (drag.mode === 'point' && drag.index >= 0) {
      /* Move adjacent corners together. */
      var base = drag.basePoints && drag.basePoints.length
        ? drag.basePoints.map(function (p) { return { x: p.x, y: p.y }; })
        : drag.entry.points.map(function (p) { return { x: p.x, y: p.y }; });
      var idx = drag.index;
      if (idx < base.length) {
        var portStart = edgePortPoint(drag.edge.source, drag.entry.from);
        var portEnd = edgePortPoint(drag.edge.target, drag.entry.to);
        var prevOrig = idx > 0 ? base[idx - 1] : portStart;
        var curOrig = base[idx];
        var nextOrig = idx + 1 < base.length ? base[idx + 1] : portEnd;

        var targetX = roundCoord(point.x);
        var targetY = roundCoord(point.y);
        if (Math.abs(targetX - prevOrig.x) <= snapTolerance) targetX = roundCoord(prevOrig.x);
        else if (Math.abs(targetX - nextOrig.x) <= snapTolerance) targetX = roundCoord(nextOrig.x);
        if (Math.abs(targetY - prevOrig.y) <= snapTolerance) targetY = roundCoord(prevOrig.y);
        else if (Math.abs(targetY - nextOrig.y) <= snapTolerance) targetY = roundCoord(nextOrig.y);

        var prevWasVertical = Math.abs(curOrig.x - prevOrig.x) <= Math.abs(curOrig.y - prevOrig.y);
        var nextWasVertical = Math.abs(nextOrig.x - curOrig.x) <= Math.abs(nextOrig.y - curOrig.y);

        if (base.length === 1) {
          var cand1 = { x: roundCoord(portStart.x), y: roundCoord(portEnd.y) };
          var cand2 = { x: roundCoord(portEnd.x), y: roundCoord(portStart.y) };
          var d1 = (point.x - cand1.x) * (point.x - cand1.x) + (point.y - cand1.y) * (point.y - cand1.y);
          var d2 = (point.x - cand2.x) * (point.x - cand2.x) + (point.y - cand2.y) * (point.y - cand2.y);
          base[0] = d1 <= d2 ? cand1 : cand2;
        } else {
          base[idx] = { x: targetX, y: targetY };

          if (idx > 0) {
            if (prevWasVertical) base[idx - 1].x = targetX;
            else base[idx - 1].y = targetY;
          } else {
            if (prevWasVertical) base[idx].x = roundCoord(portStart.x);
            else base[idx].y = roundCoord(portStart.y);
          }

          if (idx + 1 < base.length) {
            if (nextWasVertical) base[idx + 1].x = base[idx].x;
            else base[idx + 1].y = base[idx].y;
          } else {
            if (nextWasVertical) {
              base[idx].x = roundCoord(portEnd.x);
              if (idx > 0 && prevWasVertical) base[idx - 1].x = roundCoord(portEnd.x);
            } else {
              base[idx].y = roundCoord(portEnd.y);
              if (idx > 0 && !prevWasVertical) base[idx - 1].y = roundCoord(portEnd.y);
            }
          }
        }

        drag.entry.points = base;
        drag.entry.manual = true;
        drag.dirty = true;
      }
    }

    if (!drag.dirty) return;

    if (drag.mode === 'endpoint' && drag.reconnectSymbol) {
      var previewFromSym = drag.end === 'from' ? drag.reconnectSymbol : drag.edge.source;
      var previewToSym = drag.end === 'to' ? drag.reconnectSymbol : drag.edge.target;
      var previewFromSide = drag.end === 'from' ? drag.reconnectSide : drag.entry.from;
      var previewToSide = drag.end === 'to' ? drag.reconnectSide : drag.entry.to;
      var pStart = edgePortPoint(previewFromSym, previewFromSide);
      var pEnd = edgePortPoint(previewToSym, previewToSide);
      var pElbows = defaultEdgeElbows(pStart, pEnd, previewFromSide, previewToSide);
      var pPts = cleanEdgePoints(orthogonalizePoints([pStart].concat(pElbows, [pEnd])));
      var cmds = pPts.map(function (pt, i) { return [i === 0 ? 'M' : 'L', roundCoord(pt.x), roundCoord(pt.y)]; });
      try { drag.edge.path.attr('path', cmds); } catch { /* ignore */ }
      drawEdgeSelection(drag.edge);
      return;
    }

    applyEdgeGeometry(drag.edge, drag.entry);
    drawEdgeSelection(drag.edge);
  }

  function finishEdgeDrag(cancelled) {
    if (!edgeDrag) return;

    var drag = edgeDrag;
    edgeDrag = null;

    if (edgeDragFrame) {
      window.cancelAnimationFrame(edgeDragFrame);
      edgeDragFrame = 0;
    }
    if (lastSvg) lastSvg.removeAttribute('data-dragging');
    el.viewport.classList.remove('dragging-edge');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }

    if (cancelled) {
      lastPointClick = null;
      lastLineClick = null;
      restoreEdgeEntry(drag.entry, drag.snapshot);
      fitMode = drag.startFit;
      if (lastChart) redrawConnections(lastChart, true);
      return;
    }

    if (drag.mode === 'waypoint') {
      fitMode = drag.startFit;
      lastLineClick = null;
      addEdgeWaypointAt(drag.edge, { clientX: drag.lastClientX, clientY: drag.lastClientY });
      if (fitMode) fitToView();
      return;
    }

    if (!drag.started || !drag.dirty) {
      if (drag.entry) {
        if (drag.snapshot) restoreEdgeEntry(drag.entry, drag.snapshot);
        else removeEdgeEntry(drag.entry);
      }
      fitMode = drag.startFit;
      return;
    }

    if (drag.mode === 'endpoint' && drag.reconnectSymbol) {
      var oldFromKey = drag.edge.source.key;
      var oldToKey = drag.edge.target.key;
      var newFromKey = drag.end === 'from' ? drag.reconnectSymbol.key : oldFromKey;
      var newToKey = drag.end === 'to' ? drag.reconnectSymbol.key : oldToKey;
      var newFromSide = drag.end === 'from' ? drag.reconnectSide : drag.entry.from;
      var newToSide = drag.end === 'to' ? drag.reconnectSide : drag.entry.to;
      var branch = drag.edge.branch || 'next';

      if (drag.end === 'from') {
        var avail = pickAvailableBranchForSymbol(drag.reconnectSymbol, newFromSide);
        if (avail) branch = avail.branch;
      }

      removeEdgeEntry(drag.entry);
      state.edges.push({
        source: newFromKey,
        branch: branch,
        target: newToKey,
        from: newFromSide,
        to: newToSide,
        points: [],
        manual: false
      });

      var reconnected = reconnectEdgeInSource(
        state.source,
        oldFromKey,
        drag.edge.branch,
        oldToKey,
        newToKey,
        newFromKey,
        newFromSide
      );
      selectedEdgeKey = edgeKey(newFromKey, branch);
      fitMode = drag.startFit;
      commitCanvasSourceMutation(
        reconnected.source,
        drag.historySnapshot,
        '已改接连线：' + newFromKey + ' → ' + newToKey
      );
      return;
    }

    if (normalizeEdgeEntry(drag.edge, drag.entry, 7.5)) {
      applyEdgeGeometry(drag.edge, drag.entry);
    }

    pushHistorySnapshot(drag.historySnapshot);
    lastLineClick = null;
    markSaving();
    syncLayoutButton();

    if (drag.mode === 'point') lastPointClick = null;

    var previousBox = lastSvg ? readViewBox(lastSvg) : null;
    if (lastSvg && lastChart) recomputeBounds(lastSvg, lastChart);

    if (drag.startFit) {
      fitMode = true;
      fitToView();
    } else if (previousBox && lastSvg) {
      var nextBox = readViewBox(lastSvg);
      pan.x += ((nextBox.x + nextBox.w / 2) - (previousBox.x + previousBox.w / 2)) * zoom;
      pan.y += ((nextBox.y + nextBox.h / 2) - (previousBox.y + previousBox.h / 2)) * zoom;
      applyTransform();
    }

    if (lastChart) buildEdgeInteractivity(lastChart);

    toast('已调整连线', '撤销', undoManual);
  }

  function abortEdgeDrag(redraw) {
    if (!edgeDrag) return;

    var drag = edgeDrag;
    edgeDrag = null;

    if (edgeDragFrame) {
      window.cancelAnimationFrame(edgeDragFrame);
      edgeDragFrame = 0;
    }
    if (lastSvg) lastSvg.removeAttribute('data-dragging');
    el.viewport.classList.remove('dragging-edge');
    if (drag.pointerId != null && el.viewport.hasPointerCapture && el.viewport.hasPointerCapture(drag.pointerId)) {
      try { el.viewport.releasePointerCapture(drag.pointerId); } catch { /* ignore */ }
    }

    restoreEdgeEntry(drag.entry, drag.snapshot);
    fitMode = drag.startFit;
    lastPointClick = null;
    lastLineClick = null;

    if (redraw && lastChart) {
      redrawConnections(lastChart, true);
      if (lastSvg) recomputeBounds(lastSvg, lastChart);
      applyTransform();
    }
  }

  function healRemovedWaypoint(points, removeIndex, startPort, endPort) {
    var pts = (points || []).map(function (p) { return { x: p.x, y: p.y }; });
    if (removeIndex < 0 || removeIndex >= pts.length) return pts;

    if (pts.length === 1) {
      return [];
    }

    if (pts.length === 2) {
      var keep = pts[removeIndex === 0 ? 1 : 0];
      var l1 = { x: roundCoord(startPort.x), y: roundCoord(endPort.y) };
      var l2 = { x: roundCoord(endPort.x), y: roundCoord(startPort.y) };
      var d1 = (keep.x - l1.x) * (keep.x - l1.x) + (keep.y - l1.y) * (keep.y - l1.y);
      var d2 = (keep.x - l2.x) * (keep.x - l2.x) + (keep.y - l2.y) * (keep.y - l2.y);
      return [d1 <= d2 ? l1 : l2];
    }

    var full = [startPort].concat(pts, [endPort]);
    var k = removeIndex + 1; /* index in full */
    var prev = full[k - 1];
    var cur = full[k];
    var prevVert = Math.abs(cur.x - prev.x) <= Math.abs(cur.y - prev.y);

    if (k >= 2 && k <= full.length - 3) {
      var prevOuter = full[k - 2];
      var nextOuter = full[k + 2];
      var healedCorner = prevVert
        ? { x: roundCoord(prevOuter.x), y: roundCoord(nextOuter.y) }
        : { x: roundCoord(nextOuter.x), y: roundCoord(prevOuter.y) };
      pts.splice(removeIndex - 1, 3, healedCorner);
    } else if (removeIndex === 0) {
      var nextOuter0 = full[k + 2];
      var corner0 = prevVert
        ? { x: roundCoord(startPort.x), y: roundCoord(nextOuter0.y) }
        : { x: roundCoord(nextOuter0.x), y: roundCoord(startPort.y) };
      pts.splice(0, 2, corner0);
    } else {
      var prevOuterLast = full[k - 2];
      var cornerLast = prevVert
        ? { x: roundCoord(prevOuterLast.x), y: roundCoord(endPort.y) }
        : { x: roundCoord(endPort.x), y: roundCoord(prevOuterLast.y) };
      pts.splice(pts.length - 2, 2, cornerLast);
    }

    return compactOrthogonalPoints(orthogonalizePoints([startPort].concat(pts, [endPort])), 6.5)
      .slice(1, -1)
      .map(function (p) { return { x: roundCoord(p.x), y: roundCoord(p.y) }; });
  }

  function removeEdgeWaypoint(uid, index) {
    var edge = findEdgeByUid(uid);
    if (!edge) return;

    var entry = ensureEdgeOverride(edge);
    if (!entry) return;
    if (!entry.points || !entry.points.length) {
      materializeEdgeElbows(edge, entry);
    }
    if (index < 0 || index >= entry.points.length) return;

    var historySnapshot = captureManualState();
    var startPort = edgePortPoint(edge.source, entry.from);
    var endPort = edgePortPoint(edge.target, entry.to);
    entry.points = healRemovedWaypoint(entry.points, index, startPort, endPort);
    entry.manual = entry.points.length > 0;

    applyEdgeGeometry(edge, entry);
    pushHistorySnapshot(historySnapshot);
    markSaving();
    syncLayoutButton();

    var previousBox = lastSvg ? readViewBox(lastSvg) : null;
    if (lastSvg && lastChart) recomputeBounds(lastSvg, lastChart);
    if (lastSvg && lastChart) buildEdgeInteractivity(lastChart);
    if (fitMode) {
      fitToView();
    } else if (previousBox && lastSvg) {
      var nextBox = readViewBox(lastSvg);
      pan.x += ((nextBox.x + nextBox.w / 2) - (previousBox.x + previousBox.w / 2)) * zoom;
      pan.y += ((nextBox.y + nextBox.h / 2) - (previousBox.y + previousBox.h / 2)) * zoom;
      applyTransform();
    }

    toast('已删除折点并合并线段', '撤销', undoManual);
  }

  function simplifySelectedEdge() {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再调整。', null, null, 'warn');
      return;
    }
    if (!selectedEdgeKey) return;

    var edge = findCurrentEdge();
    if (!edge) return;

    var entry = ensureEdgeOverride(edge);
    var beforeCount = (entry.points || []).length;
    var historySnapshot = captureManualState();

    var startPt = edgePortPoint(edge.source, entry.from);
    var endPt = edgePortPoint(edge.target, entry.to);
    var boxes = currentObstacleBoxes(lastChart);
    var simplified = routeAroundObstacles(
      startPt,
      endPt,
      entry.from,
      entry.to,
      edge.source.key,
      edge.target.key,
      boxes,
      null
    );

    entry.points = simplified;
    entry.manual = simplified.length > 0;
    applyEdgeGeometry(edge, entry);
    pushHistorySnapshot(historySnapshot);
    markSaving();
    syncLayoutButton();
    if (lastSvg && lastChart) recomputeBounds(lastSvg, lastChart);
    if (lastChart) buildEdgeInteractivity(lastChart);

    toast(
      beforeCount > simplified.length
        ? ('已简化折线（' + beforeCount + ' → ' + simplified.length + ' 个折点）')
        : '已整理为最简正交折线',
      '撤销',
      undoManual
    );
  }

  function deleteSelectedEdge() {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再调整。', null, null, 'warn');
      return;
    }
    if (!selectedEdgeKey) return;

    var edge = findCurrentEdge();
    if (!edge || !edge.source || !edge.target) return;

    var fromKey = edge.source.key;
    var toKey = edge.target.key;
    var branch = edge.branch || 'next';
    var signature = hiddenSignatureOfEdge(edge);

    var alreadyHidden = state.hiddenEdges.some(function (entry) {
      return hiddenSignatureOfEntry(entry) === signature;
    });
    if (alreadyHidden) {
      clearEdgeSelection();
      renderNow({ animate: false });
      return;
    }

    var historySnapshot = captureManualState();
    state.hiddenEdges.push({ source: fromKey, branch: branch, target: toKey });
    clearEdgeSelection();
    pushHistorySnapshot(historySnapshot);
    markSaving();
    syncLayoutButton();
    renderNow({ animate: false });
    toast('已从图纸隐藏连线：' + fromKey + ' → ' + toKey + '（源码未改动）', '撤销', undoManual);
  }

  function resetSelectedEdge() {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再调整。', null, null, 'warn');
      return;
    }
    if (!selectedEdgeKey) return;

    var entry = null;
    for (var i = 0; i < state.edges.length; i++) {
      if (edgeKey(state.edges[i].source, state.edges[i].branch) === selectedEdgeKey) {
        entry = state.edges[i];
        break;
      }
    }

    if (!entry) {
      toast('这条连线已经是自动路由。', null, null, 'warn');
      return;
    }

    var historySnapshot = captureManualState();
    removeEdgeEntry(entry);
    pushHistorySnapshot(historySnapshot);
    markSaving();
    renderNow({ animate: false });

    toast('已恢复该连线的自动路由。', '撤销', undoManual);
  }

  /* ---------------------------------------------------------------------- */
  /* Export                                                                  */
  /* ---------------------------------------------------------------------- */

  function backgroundForExport() {
    if (state.export.bg === 'white') return '#ffffff';
    if (state.export.bg === 'sheet') {
      var value = getComputedStyle(el.sheet).getPropertyValue('--sheet-bg').trim();
      return value || '#ffffff';
    }
    return null;
  }

  function getExportSpec() {
    if (!lastSvg || el.sheet.dataset.stale === 'true') return null;
    var box = readViewBox(lastSvg);
    var pad = state.export.pad;
    var scale = state.export.format === 'svg' ? 1 : state.export.scale;
    return {
      box: box,
      pad: pad,
      width: Math.round((box.w + pad * 2) * scale),
      height: Math.round((box.h + pad * 2) * scale),
      logicalWidth: Math.round(box.w + pad * 2),
      logicalHeight: Math.round(box.h + pad * 2)
    };
  }

  function buildExportMarkup() {
    if (!lastSvg || el.sheet.dataset.stale === 'true') return null;
    var spec = getExportSpec();
    if (!spec) return null;
    var svg = lastSvg.cloneNode(true);

    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('xmlns:xlink', XLINK_NS);
    svg.removeAttribute('role');
    svg.removeAttribute('aria-label');
    svg.removeAttribute('style');
    svg.removeAttribute('data-dragging');

    $$('[data-node], [data-connector], [data-connector-label]', svg).forEach(function (node) {
      node.removeAttribute('data-node');
      node.removeAttribute('data-connector');
      node.removeAttribute('data-connector-label');
    });

    $$('[data-edge-hit], [data-edge-ui], [data-port-ui], [data-connect-preview]', svg).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    $$('[data-align-guide]', svg).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    $$('[data-node-select]', svg).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    $$('[data-marquee]', svg).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    $$('[data-hidden-edge]', svg).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });

    $$('[data-edge], [data-edge-label], [data-edge-overridden]', svg).forEach(function (node) {
      node.removeAttribute('data-edge');
      node.removeAttribute('data-edge-label');
      node.removeAttribute('data-edge-overridden');
    });

    $$('path', svg).forEach(function (path) {
      path.style.strokeDasharray = '';
      path.style.strokeDashoffset = '';
      path.style.transition = '';
      path.style.transitionDelay = '';
    });

    if (!state.export.links) {
      $$('*', svg).forEach(function (node) {
        node.removeAttribute('href');
        node.removeAttribute('target');
        node.removeAttributeNS(XLINK_NS, 'href');
        node.removeAttributeNS(XLINK_NS, 'show');
      });
    }

    var box = spec.box;
    var pad = spec.pad;
    var width = box.w + pad * 2;
    var height = box.h + pad * 2;

    svg.setAttribute('viewBox', (box.x - pad) + ' ' + (box.y - pad) + ' ' + width + ' ' + height);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    var background = backgroundForExport();
    if (background) {
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(box.x - pad));
      rect.setAttribute('y', String(box.y - pad));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
      rect.setAttribute('fill', background);
      svg.insertBefore(rect, svg.firstChild);
    }

    return {
      markup: normalizeXlink(new XMLSerializer().serializeToString(svg)),
      width: width,
      height: height,
      spec: spec
    };
  }

  /* Use xlink: instead of generated nsN: prefixes. */
  function normalizeXlink(markup) {
    var prefixes = [];
    var pattern = /xmlns:(ns\d+)="http:\/\/www\.w3\.org\/1999\/xlink"/g;
    var match;

    while ((match = pattern.exec(markup))) {
      prefixes.push(match[1]);
    }

    prefixes.forEach(function (prefix) {
      markup = markup
        .split('xmlns:' + prefix + '="http://www.w3.org/1999/xlink"').join('')
        .split(prefix + ':').join('xlink:');
    });

    return markup.replace(/xlink:show="new"/g, 'target="_blank"');
  }

  function rasterize(markup, pixelWidth, pixelHeight) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var image = new Image();

      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          var context = canvas.getContext('2d');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('无法将绘图转换为位图。'));
      };

      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('无法编码图片。'));
      }, type, quality);
    });
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportFilename(extension) {
    return slug(state.title) + '.' + extension;
  }

  function slug(value) {
    var text = String(value || '').trim().toLowerCase()
      .replace(/[\\:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\//g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 60);
    return text || 'flowchart';
  }

  function openExport() {
    if (el.sheet.dataset.stale === 'true') {
      toast('源码有错误或图纸未更新，修复后再导出。', null, null, 'warn');
      return;
    }
    if (!lastSvg) {
      toast('还没有可导出的绘图。', null, null, 'warn');
      return;
    }
    syncExportControls();
    updateExportSummary();
    el.exportDialog.showModal();
  }

  function syncExportControls() {
    var exp = state.export;
    setSegmented(el.formatSeg, 'format', exp.format);
    setSegmented(el.scaleSeg, 'scale', exp.scale);
    setSegmented(el.bgSeg, 'bg', exp.bg);
    el.padRange.value = exp.pad;
    el.padOut.textContent = exp.pad + ' px';
    el.keepLinks.checked = exp.links;
    applyExportMode();
  }

  function setSegmented(container, key, value) {
    $$('button', container).forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset[key] === String(value)));
    });
  }

  function applyExportMode() {
    var format = state.export.format;
    var isSvg = format === 'svg';

    el.scaleField.style.display = isSvg ? 'none' : '';
    el.linksCheck.style.display = isSvg ? '' : 'none';

    if (format === 'jpeg' && state.export.bg === 'transparent') {
      state.export.bg = 'white';
      setSegmented(el.bgSeg, 'bg', 'white');
    }

    $$('button', el.bgSeg).forEach(function (button) {
      button.disabled = format === 'jpeg' && button.dataset.bg === 'transparent';
    });

    el.formatNote.textContent = isSvg
      ? '矢量图 — 放大不会失真。'
      : format === 'jpeg'
        ? '带实色背景的位图。'
        : '可带透明或纸张背景的位图。';
  }

  function updateExportSummary() {
    var spec = getExportSpec();
    if (!spec) {
      el.exportSize.textContent = '—';
      el.exportNote.textContent = '没有可导出的内容。';
      return;
    }

    var format = state.export.format;
    el.exportSize.textContent = spec.width + ' × ' + spec.height + ' px';
    el.exportNote.textContent = (format === 'svg' ? 'SVG · 矢量' : format.toUpperCase() + ' · ' + state.export.scale + '×') +
      ' · ' + (state.export.bg === 'transparent' ? '无背景' : state.export.bg === 'white' ? '白色背景' : '图纸背景');
  }

  async function downloadExport() {
    var built = buildExportMarkup();
    if (!built) {
      toast('源码有错误或图纸未更新，暂时无法导出。', null, null, 'warn');
      return;
    }

    var format = state.export.format;
    var name = exportFilename(format === 'jpeg' ? 'jpg' : format);

    try {
      if (format === 'svg') {
        downloadBlob(new Blob([built.markup], { type: 'image/svg+xml;charset=utf-8' }), name);
      } else {
        var width = Math.round(built.width * state.export.scale);
        var height = Math.round(built.height * state.export.scale);
        var canvas = await rasterize(built.markup, width, height);
        var mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        var blob = await canvasToBlob(canvas, mime, 0.92);
        downloadBlob(blob, name);
      }

      el.exportDialog.close();
      toast('已导出 ' + name);
    } catch (err) {
      toast('导出失败：' + (err && err.message ? err.message : '未知错误'), null, null, 'error');
    }
  }

  async function copyExport() {
    var built = buildExportMarkup();
    if (!built) {
      toast('源码有错误或图纸未更新，暂时无法导出。', null, null, 'warn');
      return;
    }

    try {
      if (state.export.format === 'svg') {
        await copyText(built.markup);
        toast('SVG 代码已复制到剪贴板。');
      } else {
        var width = Math.round(built.width * state.export.scale);
        var height = Math.round(built.height * state.export.scale);
        var canvas = await rasterize(built.markup, width, height);
        var blob = await canvasToBlob(canvas, 'image/png');

        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast('图片已复制到剪贴板。');
        } else {
          throw new Error('此浏览器无法将图片复制到剪贴板。');
        }
      }
    } catch (err) {
      toast('复制失败：' + (err && err.message ? err.message : '未知错误') + ' 请改用下载。', null, null, 'error');
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        textarea.remove();
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Examples and files                                                      */
  /* ---------------------------------------------------------------------- */

  function loadExample(example) {
    var canUndo = el.editor.value.trim() &&
      (el.editor.value !== example.source || hasManualLayout() || hasEdgeOverrides() || state.hiddenEdges.length > 0);
    var backup = canUndo ? captureManualState() : null;

    state.layout = {};
    state.edges = [];
    state.hiddenEdges = [];
    clearEdgeSelection();
    clearNodeSelection();
    syncLayoutButton();
    state.title = example.name;
    el.docTitle.value = example.name;
    updateDocumentTitle();
    setSource(example.source);
    if (backup) pushHistorySnapshot(backup);
    else {
      lastCommittedSnapshot = captureSnapshot();
      syncHistoryButtons();
    }
    markSaving();

    if (backup) {
      toast('已载入“' + example.name + '”', '撤销', function () {
        undoManual(true);
      });
    } else {
      toast('已载入“' + example.name + '”');
    }
  }

  function setSource(text) {
    commitPendingTextHistory();
    el.editor.value = text;
    state.source = text;
    el.editor.scrollTop = 0;
    el.editor.scrollLeft = 0;
    trackedNodes = extractDefinedNodes(text).filter(function (n) { return !n.incomplete && n.key; });
    refreshEditor();
    renderNow({ animate: true });
    lastCommittedSnapshot = captureSnapshot();
    syncHistoryButtons();
    markSaving();
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast('文件超过 1 MB，请打开更小的流程文件。', null, null, 'warn');
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var canUndo = Boolean(el.editor.value.trim() || hasManualLayout() || hasEdgeOverrides() || state.hiddenEdges.length > 0);
      var backup = canUndo ? captureManualState() : null;
      var parsed = parseFlowSource(String(reader.result || ''));
      state.layout = parsed.layout;
      state.edges = parsed.edges;
      state.hiddenEdges = parsed.hiddenEdges;
      clearEdgeSelection();
      clearNodeSelection();
      syncLayoutButton();
      state.title = file.name.replace(/\.[^.]+$/, '') || '未命名流程图';
      el.docTitle.value = state.title;
      updateDocumentTitle();
      setSource(parsed.source);
      if (backup) pushHistorySnapshot(backup);
      else {
        lastCommittedSnapshot = captureSnapshot();
        syncHistoryButtons();
      }
      markSaving();
      toast('已打开 ' + file.name, backup ? '撤销' : null, backup ? function () {
        undoManual(true);
      } : null);
    };
    reader.onerror = function () {
      toast('无法读取该文件。', null, null, 'error');
    };
    reader.readAsText(file);
  }

  function downloadSource() {
    var name = exportFilename('flow');
    var content = serializeFlowSource(el.editor.value, state.layout, state.edges, state.hiddenEdges);
    downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), name);
    toast('已下载 ' + name);
  }

  /* ---------------------------------------------------------------------- */
  /* Toasts                                                                  */
  /* ---------------------------------------------------------------------- */

  function toast(message, actionLabel, action, tone) {
    var node = document.createElement('div');
    node.className = 'toast';

    var dot = document.createElement('i');
    dot.className = 'dot' + (tone === 'error' ? ' err' : tone === 'warn' ? ' warn' : '');
    node.appendChild(dot);

    var text = document.createElement('span');
    text.textContent = message;
    node.appendChild(text);

    var timer = 0;

    function remove() {
      clearTimeout(timer);
      if (node.parentNode) node.remove();
    }

    if (actionLabel && typeof action === 'function') {
      Array.prototype.slice.call(el.toastStack.querySelectorAll('.toast-action')).forEach(function (existing) {
        existing.remove();
      });

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = actionLabel;
      button.addEventListener('click', function () {
        remove();
        action();
      });
      node.appendChild(button);
    }

    el.toastStack.appendChild(node);
    while (el.toastStack.children.length > 3) {
      el.toastStack.firstElementChild.remove();
    }
    timer = setTimeout(remove, actionLabel ? 9000 : 3400);
  }

  /* ---------------------------------------------------------------------- */
  /* Popovers                                                                */
  /* ---------------------------------------------------------------------- */

  function togglePopover(popover, trigger) {
    if (!popover.hidden && currentPopover === popover) {
      closePopovers();
      return;
    }

    closePopovers();
    popover.hidden = false;
    currentPopover = popover;
    currentTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    positionPopover(popover, trigger);
  }

  function positionPopover(popover, trigger) {
    var rect = trigger.getBoundingClientRect();
    var box = popover.getBoundingClientRect();
    var left = clamp(rect.right - box.width, 10, window.innerWidth - box.width - 10);
    var top = rect.bottom + 8;

    if (top + box.height > window.innerHeight - 12) {
      top = Math.max(10, rect.top - box.height - 8);
    }

    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function closePopovers() {
    $$('.popover').forEach(function (popover) { popover.hidden = true; });
    if (currentTrigger) currentTrigger.setAttribute('aria-expanded', 'false');
    currentPopover = null;
    currentTrigger = null;
  }

  /* ---------------------------------------------------------------------- */
  /* Events                                                                  */
  /* ---------------------------------------------------------------------- */

  function bindEvents() {
    el.editor.addEventListener('input', onEditorInput);
    el.editor.addEventListener('compositionstart', function () {
      editorComposing = true;
    });
    el.editor.addEventListener('compositionend', function () {
      editorComposing = false;
      onEditorInput();
    });
    el.editor.addEventListener('scroll', function () {
      syncScroll();
      updateActiveLine();
    });
    el.editor.addEventListener('keyup', updateActiveLine);
    el.editor.addEventListener('click', updateActiveLine);
    el.editor.addEventListener('select', updateActiveLine);
    el.editor.addEventListener('keydown', function (event) {
      if (event.isComposing || event.keyCode === 229) return;

      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        insertAtCursor('  ');
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        var start = el.editor.selectionStart;
        var lineStart = el.editor.value.lastIndexOf('\n', start - 1) + 1;
        var line = el.editor.value.slice(lineStart, start);
        var indent = /^[ \t]*/.exec(line)[0];
        if (indent) {
          event.preventDefault();
          insertAtCursor('\n' + indent);
        }
      }
    });

    el.docTitle.addEventListener('input', function () {
      state.title = el.docTitle.value.trim() || '未命名流程图';
      updateDocumentTitle();
      markSaving();
    });
    el.docTitle.addEventListener('blur', function () {
      if (!el.docTitle.value.trim()) {
        el.docTitle.value = '未命名流程图';
        state.title = '未命名流程图';
        updateDocumentTitle();
        markSaving();
      }
    });

    el.examplesBtn.addEventListener('click', function () {
      togglePopover(el.examplesPop, el.examplesBtn);
    });
    el.styleBtn.addEventListener('click', function () {
      togglePopover(el.stylePop, el.styleBtn);
    });
    el.insertBtn.addEventListener('click', function () {
      togglePopover(el.insertPop, el.insertBtn);
    });

    $$('[data-close-pop]').forEach(function (button) {
      button.addEventListener('click', closePopovers);
    });

    document.addEventListener('pointerdown', function (event) {
      if (!currentPopover) return;
      if (currentPopover.contains(event.target)) return;
      if (currentTrigger && currentTrigger.contains(event.target)) return;
      closePopovers();
    });

    el.syntaxBtn.addEventListener('click', function () {
      el.syntaxDialog.showModal();
    });

    el.exportBtn.addEventListener('click', openExport);

    el.gridBtn.addEventListener('click', function () {
      state.grid = !state.grid;
      el.sheet.classList.toggle('no-grid', !state.grid);
      el.gridBtn.setAttribute('aria-pressed', String(state.grid));
      markSaving();
    });

    el.frameBtn.addEventListener('click', function () {
      state.frame = !state.frame;
      el.sheet.classList.toggle('no-frame', !state.frame);
      el.frameBtn.setAttribute('aria-pressed', String(state.frame));
      markSaving();
      if (fitMode) requestAnimationFrame(fitToView);
    });

    el.zoomIn.addEventListener('click', function () { zoomFromCenter(1.2); });
    el.zoomOut.addEventListener('click', function () { zoomFromCenter(1 / 1.2); });
    el.fitBtn.addEventListener('click', fitToView);
    if (el.undoBtn) el.undoBtn.addEventListener('click', function () { undoManual(true); });
    if (el.redoBtn) el.redoBtn.addEventListener('click', function () { redoManual(true); });
    el.layoutResetBtn.addEventListener('click', resetLayout);
    if (el.edgeSimplifyBtn) el.edgeSimplifyBtn.addEventListener('click', simplifySelectedEdge);
    el.edgeAutoBtn.addEventListener('click', resetSelectedEdge);
    if (el.edgeDeleteBtn) el.edgeDeleteBtn.addEventListener('click', deleteSelectedEdge);
    if (el.edgeFromPort) {
      el.edgeFromPort.addEventListener('change', function () {
        setEdgePort('from', el.edgeFromPort.value);
      });
    }
    if (el.edgeToPort) {
      el.edgeToPort.addEventListener('change', function () {
        setEdgePort('to', el.edgeToPort.value);
      });
    }
    el.distributeHBtn.addEventListener('click', function () { distributeSelectedNodes('horizontal'); });
    el.distributeVBtn.addEventListener('click', function () { distributeSelectedNodes('vertical'); });
    el.zoomReset.addEventListener('click', function () {
      zoom = 1;
      pan = { x: 0, y: 0 };
      fitMode = false;
      applyTransform();
    });

    el.viewport.addEventListener('wheel', function (event) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0025));
      } else {
        event.preventDefault();
        pan.x -= event.deltaX;
        pan.y -= event.deltaY;
        fitMode = false;
        applyTransform();
      }
    }, { passive: false });

    var panDrag = null;
    el.viewport.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      if (event.target.closest('.sheet-empty')) return;
      if (beginEdgeHandle(event)) return;
      if (beginConnectDrag(event)) return;
      if (beginEdgeHit(event)) return;
      if (beginNodeDrag(event)) return;
      if (event.shiftKey && startMarqueeSelection(event)) return;
      clearEdgeSelection();
      clearNodeSelection();
      panDrag = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
      el.viewport.setPointerCapture(event.pointerId);
      el.viewport.classList.add('dragging');
    });
    el.viewport.addEventListener('pointermove', function (event) {
      if (connectDrag) {
        moveConnectDrag(event);
        return;
      }
      if (edgeDrag) {
        if (event.pointerId !== edgeDrag.pointerId) return;
        edgeDrag.shiftKey = event.shiftKey;
        edgeDrag.lastClientX = event.clientX;
        edgeDrag.lastClientY = event.clientY;
        scheduleEdgeDragFrame();
        return;
      }
      if (nodeDrag) {
        if (event.pointerId !== nodeDrag.pointerId) return;
        if (!nodeDrag.started) {
          var mx = Math.abs(event.clientX - nodeDrag.startClientX);
          var my = Math.abs(event.clientY - nodeDrag.startClientY);
          if (mx < 3 && my < 3) return;
        }
        nodeDrag.started = true;
        nodeDrag.altKey = event.altKey;
        nodeDrag.lastClientX = event.clientX;
        nodeDrag.lastClientY = event.clientY;
        scheduleNodeDragFrame();
        return;
      }
      if (marqueeDrag) {
        moveMarquee(event);
        return;
      }
      if (!panDrag) {
        if (lastSvg && lastChart && el.sheet.dataset.stale !== 'true') {
          var portHover = event.target && event.target.closest ? event.target.closest('[data-port-node]') : null;
          var nextHover = '';
          if (portHover) {
            nextHover = portHover.getAttribute('data-port-node') || '';
          } else {
            var userPt = clientToUser(lastSvg, event.clientX, event.clientY);
            var sym = userPt ? symbolNearPoint(lastChart, userPt, 8) : null;
            nextHover = sym && sym.key ? sym.key : '';
          }
          if (nextHover !== hoveredNodeKey) {
            hoveredNodeKey = nextHover;
            drawNodePortHandles();
          }
        }
        return;
      }
      pan.x = panDrag.px + (event.clientX - panDrag.x);
      pan.y = panDrag.py + (event.clientY - panDrag.y);
      fitMode = false;
      applyTransform();
    });
    el.viewport.addEventListener('pointerleave', function () {
      if (hoveredNodeKey && !connectDrag) {
        hoveredNodeKey = '';
        drawNodePortHandles();
      }
    });
    function endPan() {
      if (!panDrag) return;
      panDrag = null;
      el.viewport.classList.remove('dragging');
    }
    el.viewport.addEventListener('pointerup', function () {
      if (connectDrag) {
        finishConnectDrag(false);
        return;
      }
      if (edgeDrag) {
        finishEdgeDrag(false);
        return;
      }
      if (nodeDrag) {
        finishNodeDrag(false);
        return;
      }
      if (marqueeDrag) {
        finishMarquee(false);
        return;
      }
      endPan();
    });
    el.viewport.addEventListener('pointercancel', function () {
      if (connectDrag) {
        finishConnectDrag(true);
        return;
      }
      if (edgeDrag) {
        finishEdgeDrag(true);
        return;
      }
      if (nodeDrag) {
        finishNodeDrag(true);
        return;
      }
      if (marqueeDrag) {
        finishMarquee(true);
        return;
      }
      endPan();
    });
    el.viewport.addEventListener('contextmenu', function (event) {
      var handle = event.target.closest('[data-edge-handle]');
      if (handle && handle.getAttribute('data-edge-handle') === 'point') {
        event.preventDefault();
        event.stopPropagation();
        removeEdgeWaypoint(handle.getAttribute('data-edge-uid'), Number(handle.getAttribute('data-edge-point')));
      }
    });
    el.viewport.addEventListener('dblclick', function (event) {
      if (suppressEdgeDblclick || Date.now() - lastEdgeInteractionAt < 600) {
        suppressEdgeDblclick = false;
        return;
      }
      var handle = event.target.closest('[data-edge-handle]');
      if (handle && handle.getAttribute('data-edge-handle') === 'point') {
        event.preventDefault();
        event.stopPropagation();
        removeEdgeWaypoint(handle.getAttribute('data-edge-uid'), Number(handle.getAttribute('data-edge-point')));
        return;
      }
      if (event.target.closest('[data-edge-hit], [data-edge-ui], [data-port-ui]')) return;
      if (event.target.closest('[data-node]')) return;
      fitToView();
    });

    var splitDrag = null;
    el.splitter.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      splitDrag = true;
      el.splitter.setPointerCapture(event.pointerId);
      document.body.classList.add('resizing');
      event.preventDefault();
    });
    el.splitter.addEventListener('pointermove', function (event) {
      if (!splitDrag) return;
      var rect = el.workspace.getBoundingClientRect();
      var percent = clamp(((event.clientX - rect.left) / rect.width) * 100, 26, 68);
      state.editorWidth = percent;
      el.workspace.style.setProperty('--editor-w', percent + '%');
      el.splitter.setAttribute('aria-valuenow', String(Math.round(percent)));
    });
    function endSplit() {
      if (!splitDrag) return;
      splitDrag = false;
      document.body.classList.remove('resizing');
      markSaving();
      if (fitMode) fitToView();
    }
    el.splitter.addEventListener('pointerup', endSplit);
    el.splitter.addEventListener('pointercancel', endSplit);
    el.splitter.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      state.editorWidth = clamp(state.editorWidth + (event.key === 'ArrowLeft' ? -2 : 2), 26, 68);
      el.workspace.style.setProperty('--editor-w', state.editorWidth + '%');
      el.splitter.setAttribute('aria-valuenow', String(Math.round(state.editorWidth)));
      markSaving();
      if (fitMode) fitToView();
    });

    el.fontSizeRange.addEventListener('input', function () {
      state.style.fontSize = Number(el.fontSizeRange.value);
      el.fontSizeOut.textContent = el.fontSizeRange.value;
      scheduleRender(60);
      markSaving();
    });
    el.lineWidthRange.addEventListener('input', function () {
      state.style.lineWidth = Number(el.lineWidthRange.value);
      el.lineWidthOut.textContent = el.lineWidthRange.value;
      scheduleRender(60);
      markSaving();
    });
    el.lineLengthRange.addEventListener('input', function () {
      state.style.lineLength = Number(el.lineLengthRange.value);
      el.lineLengthOut.textContent = el.lineLengthRange.value;
      scheduleRender(60);
      markSaving();
    });
    el.textMarginRange.addEventListener('input', function () {
      state.style.textMargin = Number(el.textMarginRange.value);
      el.textMarginOut.textContent = el.textMarginRange.value;
      scheduleRender(60);
      markSaving();
    });
    el.fontSelect.addEventListener('change', function () {
      state.style.font = el.fontSelect.value;
      scheduleRender(40);
      markSaving();
    });
    el.arrowSelect.addEventListener('change', function () {
      state.style.arrow = el.arrowSelect.value;
      scheduleRender(40);
      markSaving();
    });
    el.yesInput.addEventListener('input', function () {
      state.style.yes = el.yesInput.value.slice(0, 14) || 'yes';
      scheduleRender(220);
      markSaving();
    });
    el.noInput.addEventListener('input', function () {
      state.style.no = el.noInput.value.slice(0, 14) || 'no';
      scheduleRender(220);
      markSaving();
    });
    el.animateToggle.addEventListener('change', function () {
      state.style.animate = el.animateToggle.checked;
      markSaving();
    });
    el.jumpsToggle.addEventListener('change', function () {
      state.style.jumps = el.jumpsToggle.checked;
      applyLineJumps();
      if (lastChart) buildEdgeInteractivity(lastChart);
      markSaving();
    });
    el.resetStyleBtn.addEventListener('click', function () {
      state.style = {
        fontSize: 14,
        lineWidth: 3,
        lineLength: 50,
        textMargin: 10,
        font: 'sans',
        arrow: 'classic',
        yes: '是',
        no: '否',
        animate: state.style.animate,
        jumps: state.style.jumps
      };
      syncStyleControls();
      scheduleRender(40);
      markSaving();
      toast('样式已重置为制图默认值。');
    });

    el.diagDismiss.addEventListener('click', function () {
      diagDismissed = true;
      el.diagnostics.hidden = true;
    });

    el.emptyExampleBtn.addEventListener('click', function () {
      togglePopover(el.examplesPop, el.examplesBtn);
    });

    el.openBtn.addEventListener('click', function () { el.fileInput.click(); });
    el.fileInput.addEventListener('change', function () {
      var file = el.fileInput.files && el.fileInput.files[0];
      if (file) readFile(file);
      el.fileInput.value = '';
    });
    el.downloadSourceBtn.addEventListener('click', downloadSource);

    ['dragenter', 'dragover'].forEach(function (type) {
      el.editorBody.addEventListener(type, function (event) {
        event.preventDefault();
        el.editorBody.classList.add('drop');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (type) {
      el.editorBody.addEventListener(type, function (event) {
        event.preventDefault();
        el.editorBody.classList.remove('drop');
      });
    });
    el.editorBody.addEventListener('drop', function (event) {
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) readFile(file);
    });

    $$('.mobile-switch button').forEach(function (button) {
      button.addEventListener('click', function () {
        state.mobilePane = button.dataset.pane;
        document.body.dataset.pane = state.mobilePane;
        syncMobileSwitch();
        markSaving();
        if (state.mobilePane === 'sheet') {
          if (fitMode) requestAnimationFrame(fitToView);
          if (selectedEdgeKey) requestAnimationFrame(showEdgeToolbar);
          if (selectedNodeKeys.length >= 3) requestAnimationFrame(updateNodeToolbar);
        } else {
          hideEdgeToolbar();
          hideNodeToolbar();
        }
      });
    });

    el.formatSeg.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-format]');
      if (!button) return;
      state.export.format = button.dataset.format;
      setSegmented(el.formatSeg, 'format', state.export.format);
      applyExportMode();
      updateExportSummary();
      markSaving();
    });
    el.scaleSeg.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-scale]');
      if (!button) return;
      state.export.scale = Number(button.dataset.scale);
      setSegmented(el.scaleSeg, 'scale', state.export.scale);
      updateExportSummary();
      markSaving();
    });
    el.bgSeg.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-bg]');
      if (!button || button.disabled) return;
      state.export.bg = button.dataset.bg;
      setSegmented(el.bgSeg, 'bg', state.export.bg);
      updateExportSummary();
      markSaving();
    });
    el.padRange.addEventListener('input', function () {
      state.export.pad = Number(el.padRange.value);
      el.padOut.textContent = state.export.pad + ' px';
      updateExportSummary();
      markSaving();
    });
    el.keepLinks.addEventListener('change', function () {
      state.export.links = el.keepLinks.checked;
      markSaving();
    });
    el.downloadBtn.addEventListener('click', downloadExport);
    el.copyBtn.addEventListener('click', copyExport);

    $$('[data-close-dialog]').forEach(function (button) {
      button.addEventListener('click', function () {
        var dialog = button.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    $$('dialog').forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
    });

    $$('[data-insert]').forEach(function (button) {
      button.addEventListener('click', function () {
        insertSnippet(button.dataset.insert);
        var dialog = button.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    document.addEventListener('keydown', function (event) {
      var mod = event.ctrlKey || event.metaKey;

      if (mod && !event.altKey && event.key.toLowerCase() === 'z') {
        if (isNonEditorInputTarget(event.target) || document.querySelector('dialog[open]')) return;
        event.preventDefault();
        if (event.shiftKey) redoManual(false);
        else undoManual(false);
        return;
      }

      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'y') {
        if (isNonEditorInputTarget(event.target) || document.querySelector('dialog[open]')) return;
        event.preventDefault();
        redoManual(false);
        return;
      }

      if (event.key === 'Escape') {
        if (currentPopover) {
          closePopovers();
          return;
        }
        if (connectDrag) {
          abortConnectDrag();
          return;
        }
        if (edgeDrag) {
          abortEdgeDrag(true);
          return;
        }
        if (marqueeDrag) {
          finishMarquee(true);
          return;
        }
        if (selectedEdgeKey) {
          clearEdgeSelection();
          return;
        }
        if (selectedNodeKeys.length) {
          clearNodeSelection();
          return;
        }
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !mod && !event.altKey) {
        var activeTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
        if (activeTag !== 'textarea' && activeTag !== 'input' && activeTag !== 'select' &&
            !document.querySelector('dialog[open]') && selectedEdgeKey) {
          event.preventDefault();
          deleteSelectedEdge();
          return;
        }
      }

      if (mod && event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(renderTimer);
        renderNow({ animate: true });
        return;
      }

      if (mod && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        downloadSource();
        return;
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        openExport();
        return;
      }

      if (mod && event.key === '/') {
        event.preventDefault();
        toggleComment();
      }
    });

    window.addEventListener('resize', function () {
      closePopovers();
      if (fitMode) fitToView();
      positionEdgeToolbar();
      positionNodeToolbar();
    });
  }

  boot();
})();
