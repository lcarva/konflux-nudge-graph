var nodeInfo = {};
var succ = {};
var pred = {};
graphData.nodes.forEach(function(n) {
  nodeInfo[n.id] = n;
  succ[n.id] = [];
  pred[n.id] = [];
});
graphData.edges.forEach(function(e) {
  succ[e.src].push(e.dst);
  pred[e.dst].push(e.src);
});

var hasGradeData = graphData.nodes.some(function(n) { return n.grade !== null; });
var hasCveData = graphData.nodes.some(function(n) { return n.openCves !== null; });

function streamKey(s) {
  if (s === 'main') return [-1, -1];
  var m = s.match(/^v(\d+)-(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : [999, 999];
}
var allStreams = graphData.streams.slice().sort(function(a, b) {
  var ka = streamKey(a), kb = streamKey(b);
  return (ka[0] - kb[0]) || (ka[1] - kb[1]) || (a < b ? -1 : a > b ? 1 : 0);
});

var layerOf = {};
(function() {
  var indeg = {}, queue = [];
  graphData.nodes.forEach(function(n) {
    layerOf[n.id] = 0;
    indeg[n.id] = pred[n.id].length;
    if (!indeg[n.id]) queue.push(n.id);
  });
  while (queue.length) {
    var u = queue.shift();
    succ[u].forEach(function(v) {
      layerOf[v] = Math.max(layerOf[v], layerOf[u] + 1);
      if (--indeg[v] === 0) queue.push(v);
    });
  }
})();

function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---- themes and colours ----

var THEMES = {
  dark: {
    label: '#ddd', outline: '#1a1a2e', border: '#555', edge: '#444',
    hlBorder: '#fff', hlLabel: '#fff', nbBorder: '#aaa', nbLabel: '#ccc',
    down: '#f0a07f', up: '#7ff0b0',
    laneFill: '#ffffff', laneOpacity: 0.04, laneBorder: '#3a3a5e', laneLabel: '#8a8aa8',
    role: { source: '#96e6a1', sink: '#ff8a80', relay: '#a78bfa' },
    grade: { A: '#4cd37a', B: '#a3d94c', C: '#f2d14b', D: '#f5a142', E: '#ef6a4a', F: '#e5484d' },
    cve: ['#4cd37a', '#f2d14b', '#f5a142', '#e5484d'],
    unknown: '#7a7a8c',
  },
  light: {
    label: '#333', outline: '#ffffff', border: '#888', edge: '#bbb',
    hlBorder: '#000', hlLabel: '#000', nbBorder: '#555', nbLabel: '#222',
    down: '#e0701f', up: '#2e9e4f',
    laneFill: '#000000', laneOpacity: 0.03, laneBorder: '#c8c8d4', laneLabel: '#6a6a80',
    role: { source: '#2e9e4f', sink: '#e5484d', relay: '#7c5cdb' },
    grade: { A: '#2e9e4f', B: '#7fb21f', C: '#d9b100', D: '#e0841f', E: '#d9482b', F: '#b3202a' },
    cve: ['#2e9e4f', '#d9b100', '#e0841f', '#d12d35'],
    unknown: '#9aa0a6',
  },
};
var CVE_BUCKETS = ['0', '1-2', '3-5', '6+'];

function cveBucket(n) { return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3; }

var theme = defaultTheme;
try { theme = localStorage.getItem('nudge-graph-theme') || defaultTheme; } catch (e) {}
var colorMode = hasGradeData ? 'grade' : (hasCveData ? 'cves' : 'role');

function nodeColor(n) {
  var T = THEMES[theme];
  if (colorMode === 'grade') return T.grade[n.grade] || T.unknown;
  if (colorMode === 'cves') return n.openCves === null ? T.unknown : T.cve[cveBucket(n.openCves)];
  return T.role[n.role];
}

function nodeLabel(n) {
  if (colorMode === 'grade' && n.grade) return n.id + ' [' + n.grade + ']';
  if (colorMode === 'cves' && n.openCves) return n.id + ' (' + n.openCves + ')';
  return n.id;
}

function nodeSize(n) {
  return colorMode === 'cves' && n.openCves ? 14 + Math.min(n.openCves, 12) * 2 : 14;
}

function buildStyle() {
  var T = THEMES[theme];
  return [
    {
      selector: 'node:childless',
      style: {
        'label': 'data(label)',
        'font-size': '9px',
        'color': T.label,
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-halign': 'center',
        'background-color': 'data(color)',
        'width': 'data(size)',
        'height': 'data(size)',
        'border-width': 1,
        'border-color': T.border,
        'text-outline-width': 2,
        'text-outline-color': T.outline,
        'min-zoomed-font-size': 8,
      }
    },
    {
      selector: 'node.lane',
      style: {
        'label': 'data(label)',
        'shape': 'round-rectangle',
        'padding': '30px',
        'text-valign': 'top',
        'text-halign': 'center',
        'font-size': '28px',
        'font-weight': 'bold',
        'color': T.laneLabel,
        'background-color': T.laneFill,
        'background-opacity': T.laneOpacity,
        'border-width': 1,
        'border-color': T.laneBorder,
        'min-zoomed-font-size': 0,
        'events': 'no',
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': T.edge,
        'target-arrow-color': T.edge,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      }
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 3,
        'border-color': T.hlBorder,
        'width': 28,
        'height': 28,
        'font-size': '12px',
        'font-weight': 'bold',
        'color': T.hlLabel,
        'z-index': 10,
      }
    },
    {
      selector: 'node.neighbor',
      style: {
        'border-width': 2,
        'border-color': T.nbBorder,
        'width': 24,
        'height': 24,
        'color': T.nbLabel,
        'z-index': 9,
      }
    },
    {
      selector: 'edge.downstream',
      style: { 'width': 3, 'line-color': T.down, 'target-arrow-color': T.down, 'z-index': 10 }
    },
    {
      selector: 'edge.upstream',
      style: { 'width': 3, 'line-color': T.up, 'target-arrow-color': T.up, 'z-index': 10 }
    },
    { selector: 'node.dimmed', style: { 'opacity': 0.15 } },
    { selector: 'edge.dimmed', style: { 'opacity': 0.08 } },
    { selector: '.hidden', style: { 'display': 'none' } },
  ];
}

// ---- swimlane layout: one lane per stream, columns are nudge depth ----

var COL_W = 200;
var ROW_H = 48;
var LANE_PAD = 50;
var LANE_GAP = 40;
var MAX_ROWS = 10;

var visibleStreams = {};
allStreams.forEach(function(s) { visibleStreams[s] = true; });

function orderLane(layers, keys, stream, row) {
  function rank(id, adj) {
    var rs = adj[id].filter(function(x) { return row[x] !== undefined && nodeInfo[x].stream === stream; })
      .map(function(x) { return row[x]; });
    if (!rs.length) return row[id];
    return rs.reduce(function(a, b) { return a + b; }, 0) / rs.length;
  }
  function sweep(layerKeys, adj) {
    layerKeys.forEach(function(l) {
      var ranks = {};
      layers[l].forEach(function(id) { ranks[id] = rank(id, adj); });
      layers[l].sort(function(a, b) { return (ranks[a] - ranks[b]) || (a < b ? -1 : 1); });
      layers[l].forEach(function(id, i) { row[id] = i; });
    });
  }
  for (var pass = 0; pass < 3; pass++) {
    sweep(keys, pred);
    sweep(keys.slice().reverse(), succ);
  }
}

function computePositions() {
  var pos = {};
  var top = 0;
  allStreams.forEach(function(s) {
    if (!visibleStreams[s]) return;
    var layers = {};
    graphData.nodes.forEach(function(n) {
      if (n.stream !== s) return;
      (layers[layerOf[n.id]] = layers[layerOf[n.id]] || []).push(n.id);
    });
    var keys = Object.keys(layers).map(Number).sort(function(a, b) { return a - b; });
    var row = {};
    keys.forEach(function(l) {
      layers[l].sort();
      layers[l].forEach(function(id, i) { row[id] = i; });
    });
    orderLane(layers, keys, s, row);
    var maxRows = Math.min(MAX_ROWS, Math.max.apply(null, keys.map(function(l) { return layers[l].length; })));
    var slot = 0;
    keys.forEach(function(l) {
      layers[l].forEach(function(id, i) {
        var inSlot = Math.min(MAX_ROWS, layers[l].length - Math.floor(i / MAX_ROWS) * MAX_ROWS);
        var offset = (maxRows - inSlot) / 2;
        pos[id] = {
          x: (slot + Math.floor(i / MAX_ROWS)) * COL_W,
          y: top + LANE_PAD + (offset + i % MAX_ROWS) * ROW_H,
        };
      });
      slot += Math.ceil(layers[l].length / MAX_ROWS);
    });
    top += (maxRows - 1) * ROW_H + 2 * LANE_PAD + LANE_GAP;
  });
  return pos;
}

// ---- graph ----

var elements = [];
allStreams.forEach(function(s) {
  elements.push({ data: { id: 'lane:' + s, label: s }, classes: 'lane' });
});
graphData.nodes.forEach(function(n) {
  elements.push({ data: { id: n.id, parent: 'lane:' + n.stream } });
});
var seenEdges = {};
graphData.edges.forEach(function(e) {
  var id = e.src + '->' + e.dst;
  if (seenEdges[id]) return;
  seenEdges[id] = true;
  elements.push({ data: { id: id, source: e.src, target: e.dst } });
});

var cy = cytoscape({
  container: document.getElementById('cy'),
  elements: elements,
  style: buildStyle(),
  wheelSensitivity: 0.3,
});

var ITEMS = 'node:childless, edge';

function applyLayout() {
  var pos = computePositions();
  cy.layout({
    name: 'preset',
    positions: function(n) { return pos[n.id()] || n.position(); },
    fit: true,
    padding: 40,
  }).run();
}

function applyColors() {
  cy.batch(function() {
    cy.nodes(':childless').forEach(function(c) {
      var n = nodeInfo[c.id()];
      c.data('color', nodeColor(n));
      c.data('size', nodeSize(n));
      c.data('label', nodeLabel(n));
    });
  });
}

function renderLegend() {
  var T = THEMES[theme];
  var items = [];
  function item(color, text) {
    items.push('<span class="item"><span class="dot" style="background:' + color + '"></span> ' + esc(text) + '</span>');
  }
  if (colorMode === 'role') {
    item(T.role.source, 'Source'); item(T.role.sink, 'Sink'); item(T.role.relay, 'Relay');
  } else if (colorMode === 'grade') {
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function(g) { item(T.grade[g], g); });
    item(T.unknown, 'Not in catalog');
  } else {
    CVE_BUCKETS.forEach(function(b, i) { item(T.cve[i], b + ' open CVEs'); });
    item(T.unknown, 'Not in catalog');
    items.push('<span class="item note">Node size grows with CVE count</span>');
  }
  document.getElementById('legend').innerHTML = items.join('');
}

function applyTheme() {
  document.body.setAttribute('data-theme', theme);
  cy.style(buildStyle());
  applyColors();
  renderLegend();
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? 'Light background' : 'Dark background';
}

// ---- info panel ----

function reach(start, adj) {
  var seen = {};
  var stack = [start];
  while (stack.length) {
    var u = stack.pop();
    adj[u].forEach(function(v) {
      if (!seen[v]) { seen[v] = true; stack.push(v); }
    });
  }
  return seen;
}

// Naive: each fix rebuilt on its own, each cascading to the image. Batched: all fixes land first, each image rebuilds once.
function rebuildPreview(leaf) {
  var T = reach(leaf, pred);
  T[leaf] = true;
  var fixes = Object.keys(T).filter(function(id) {
    return hasCveData ? (nodeInfo[id].openCves || 0) > 0 : true;
  });
  var basis = hasCveData ? 'components with open CVEs' : 'every upstream component (no CVE data loaded)';
  var html = '<div class="section"><b>Rebuild preview</b> <span class="hint">(' + basis + ')</span>';
  if (!fixes.length) return html + '<br><span class="hint">No open CVEs upstream of this image.</span></div>';

  var naive = 0;
  var batched = {};
  fixes.forEach(function(s) {
    var count = 1;
    batched[s] = true;
    Object.keys(reach(s, succ)).forEach(function(x) {
      if (x !== s && T[x]) { count++; batched[x] = true; }
    });
    naive += count;
  });
  var b = Object.keys(batched).length;
  var saved = naive - b;
  return html
    + '<div class="stat"><span>Fix points</span><b>' + fixes.length + '</b></div>'
    + '<div class="stat"><span>Naive builds</span><b>' + naive + '</b></div>'
    + '<div class="stat"><span>Batched builds</span><b>' + b + '</b></div>'
    + '<div class="stat"><span>Saved</span><b>' + saved + ' (' + Math.round(100 * saved / naive) + '%)</b></div></div>';
}

function nodeDetails(id) {
  var n = nodeInfo[id];
  var html = '<div class="stat"><span>Stream</span><b>' + esc(n.stream) + '</b></div>';
  if (hasGradeData) html += '<div class="stat"><span>Catalog grade</span><b>' + esc(n.grade || 'n/a') + '</b></div>';
  if (hasCveData) html += '<div class="stat"><span>Open CVEs</span><b>' + (n.openCves === null ? 'n/a' : n.openCves) + '</b></div>';
  if (n.repository) html += '<div>Repository: ' + esc(n.repository) + '</div>';
  if (hasCveData) {
    var up = Object.keys(reach(id, pred)).filter(function(u) { return (nodeInfo[u].openCves || 0) > 0; });
    if (up.length) {
      html += '<div class="section"><b>CVEs entering upstream:</b> '
        + up.map(function(u) { return esc(u) + ' (' + nodeInfo[u].openCves + ')'; }).join(', ') + '</div>';
    }
  }
  return html;
}

function resetHighlight() {
  cy.elements().removeClass('highlighted neighbor dimmed downstream upstream');
  document.getElementById('info-title').textContent = 'Component Nudge Graph';
  document.getElementById('info-body').innerHTML = '<span class="hint">Click a node to highlight its connections.<br>Click background to reset.</span>';
}

function selectNode(node) {
  resetHighlight();

  var downstream = node.successors();
  var upstream = node.predecessors();
  var full = downstream.union(upstream).union(node);

  cy.elements(ITEMS).addClass('dimmed');
  full.removeClass('dimmed');

  node.addClass('highlighted');
  full.nodes().not(node).addClass('neighbor');
  downstream.edges().addClass('downstream');
  upstream.edges().addClass('upstream');

  var directOut = node.outgoers('node').map(function(n) { return n.id(); });
  var allOut = downstream.nodes().map(function(n) { return n.id(); });
  var directIn = node.incomers('node').map(function(n) { return n.id(); });
  var allIn = upstream.nodes().map(function(n) { return n.id(); });

  var html = nodeDetails(node.id());
  if (nodeInfo[node.id()].role === 'sink') html += rebuildPreview(node.id());
  if (allOut.length) html += '<div class="section"><b>Nudges (' + directOut.length + ' direct, ' + allOut.length + ' total):</b> ' + allOut.map(esc).join(', ') + '</div>';
  if (allIn.length) html += '<div class="section"><b>Nudged by (' + directIn.length + ' direct, ' + allIn.length + ' total):</b> ' + allIn.map(esc).join(', ') + '</div>';
  if (!allOut.length && !allIn.length) html += '<div class="section"><span class="hint">No nudge connections</span></div>';

  document.getElementById('info-title').textContent = node.id();
  document.getElementById('info-body').innerHTML = html;

  cy.animate({ center: { eles: node }, duration: 300 });
}

cy.on('tap', 'node:childless', function(evt) { selectNode(evt.target); });

cy.on('tap', function(evt) {
  if (evt.target === cy) {
    resetHighlight();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
  }
});

// ---- controls ----

function applyFilter() {
  cy.batch(function() {
    allStreams.forEach(function(s) {
      var hidden = !visibleStreams[s];
      cy.getElementById('lane:' + s).toggleClass('hidden', hidden);
      cy.nodes(':childless').forEach(function(n) {
        if (nodeInfo[n.id()].stream === s) n.toggleClass('hidden', hidden);
      });
    });
    cy.edges().forEach(function(e) {
      e.toggleClass('hidden', e.source().hasClass('hidden') || e.target().hasClass('hidden'));
    });
  });
  resetHighlight();
  applyLayout();
}

var filterEl = document.getElementById('stream-filter');
allStreams.forEach(function(s) {
  var count = graphData.nodes.filter(function(n) { return n.stream === s; }).length;
  var label = document.createElement('label');
  var box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = true;
  box.dataset.stream = s;
  box.addEventListener('change', function() {
    visibleStreams[s] = box.checked;
    applyFilter();
  });
  label.appendChild(box);
  label.appendChild(document.createTextNode(s + ' (' + count + ')'));
  filterEl.appendChild(label);
});

var modeEl = document.getElementById('color-mode');
modeEl.querySelector('option[value="grade"]').disabled = !hasGradeData;
modeEl.querySelector('option[value="cves"]').disabled = !hasCveData;
modeEl.value = colorMode;
modeEl.addEventListener('change', function() {
  colorMode = modeEl.value;
  applyColors();
  renderLegend();
});

document.getElementById('theme-toggle').addEventListener('click', function() {
  theme = theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('nudge-graph-theme', theme); } catch (e) {}
  applyTheme();
});

document.getElementById('export-json').addEventListener('click', function() {
  var blob = new Blob([JSON.stringify(graphData, null, 2) + '\n'], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nudge-graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- search ----

var searchInput = document.getElementById('search-input');
var searchResults = document.getElementById('search-results');
var allNodeIds = graphData.nodes.map(function(n) { return n.id; }).sort();

searchInput.addEventListener('input', function() {
  var q = this.value.toLowerCase().trim();
  searchResults.innerHTML = '';
  if (!q) return;
  var matches = allNodeIds.filter(function(id) { return id.toLowerCase().includes(q); });
  matches.slice(0, 15).forEach(function(id) {
    var div = document.createElement('div');
    var idx = id.toLowerCase().indexOf(q);
    div.innerHTML = esc(id.substring(0, idx))
      + '<span class="match">' + esc(id.substring(idx, idx + q.length)) + '</span>'
      + esc(id.substring(idx + q.length));
    div.addEventListener('click', function() {
      var stream = nodeInfo[id].stream;
      if (!visibleStreams[stream]) {
        visibleStreams[stream] = true;
        filterEl.querySelector('input[data-stream="' + stream + '"]').checked = true;
        applyFilter();
      }
      selectNode(cy.getElementById(id));
      searchInput.value = id;
      searchResults.innerHTML = '';
    });
    searchResults.appendChild(div);
  });
});

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    var first = searchResults.querySelector('div');
    if (first) first.click();
  }
});

applyTheme();
applyLayout();
