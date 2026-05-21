var nodeSet = {};
var elements = [];
var hasOutgoing = {};
var hasIncoming = {};

edgesData.forEach(function(e) {
  hasOutgoing[e.src] = true;
  hasIncoming[e.dst] = true;
  nodeSet[e.src] = true;
  nodeSet[e.dst] = true;
  elements.push({ data: { id: e.src + '->' + e.dst, source: e.src, target: e.dst } });
});

Object.keys(nodeSet).forEach(function(id) {
  var type = (hasOutgoing[id] && hasIncoming[id]) ? 'relay'
           : hasOutgoing[id] ? 'source'
           : 'sink';
  elements.push({ data: { id: id, type: type } });
});

var cy = cytoscape({
  container: document.getElementById('cy'),
  elements: elements,
  style: [
    {
      selector: 'node',
      style: {
        'label': 'data(id)',
        'font-size': '9px',
        'color': '#ddd',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-halign': 'center',
        'background-color': '#7fbbf0',
        'width': 14,
        'height': 14,
        'border-width': 1,
        'border-color': '#555',
        'text-outline-width': 2,
        'text-outline-color': '#1a1a2e',
        'min-zoomed-font-size': 8,
      }
    },
    {
      selector: 'node[type="source"]',
      style: { 'background-color': '#96e6a1' }
    },
    {
      selector: 'node[type="sink"]',
      style: { 'background-color': '#ff8a80' }
    },
    {
      selector: 'node[type="relay"]',
      style: { 'background-color': '#a78bfa' }
    },
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#444',
        'target-arrow-color': '#444',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      }
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 3,
        'border-color': '#fff',
        'width': 28,
        'height': 28,
        'font-size': '12px',
        'font-weight': 'bold',
        'color': '#fff',
        'z-index': 10,
      }
    },
    {
      selector: 'node.neighbor',
      style: {
        'border-width': 2,
        'border-color': '#aaa',
        'width': 24,
        'height': 24,
        'color': '#ccc',
        'z-index': 9,
      }
    },
    {
      selector: 'edge.downstream',
      style: {
        'width': 3,
        'line-color': '#f0a07f',
        'target-arrow-color': '#f0a07f',
        'z-index': 10,
      }
    },
    {
      selector: 'edge.upstream',
      style: {
        'width': 3,
        'line-color': '#7ff0b0',
        'target-arrow-color': '#7ff0b0',
        'z-index': 10,
      }
    },
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.15,
      }
    },
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.08,
      }
    },
  ],
  layout: {
    name: 'cose',
    nodeRepulsion: function() { return 50000; },
    idealEdgeLength: function() { return 200; },
    edgeElasticity: function() { return 50; },
    gravity: 0.1,
    gravityRange: 1.5,
    nestingFactor: 1.2,
    numIter: 2000,
    nodeDimensionsIncludeLabels: true,
    padding: 60,
    animate: false,
  },
  wheelSensitivity: 0.3,
});

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

  cy.elements().addClass('dimmed');
  full.removeClass('dimmed');

  node.addClass('highlighted');
  full.nodes().not(node).addClass('neighbor');
  downstream.edges().addClass('downstream');
  upstream.edges().addClass('upstream');

  var directOut = node.outgoers('node').map(function(n) { return n.id(); });
  var allOut = downstream.nodes().map(function(n) { return n.id(); });
  var directIn = node.incomers('node').map(function(n) { return n.id(); });
  var allIn = upstream.nodes().map(function(n) { return n.id(); });

  var html = '';
  if (allOut.length) html += '<b>Nudges (' + directOut.length + ' direct, ' + allOut.length + ' total):</b> ' + allOut.join(', ');
  if (allIn.length) html += (html ? '<br>' : '') + '<b>Nudged by (' + directIn.length + ' direct, ' + allIn.length + ' total):</b> ' + allIn.join(', ');
  if (!allOut.length && !allIn.length) html += '<span class="hint">No nudge connections</span>';

  document.getElementById('info-title').textContent = node.id();
  document.getElementById('info-body').innerHTML = html;

  cy.animate({ center: { eles: node }, duration: 300 });
}

cy.on('tap', 'node', function(evt) { selectNode(evt.target); });

cy.on('tap', function(evt) {
  if (evt.target === cy) {
    resetHighlight();
    document.getElementById('search-input').value = '';
    document.getElementById('search-results').innerHTML = '';
  }
});

var searchInput = document.getElementById('search-input');
var searchResults = document.getElementById('search-results');
var allNodeIds = cy.nodes().map(function(n) { return n.id(); }).sort();

searchInput.addEventListener('input', function() {
  var q = this.value.toLowerCase().trim();
  searchResults.innerHTML = '';
  if (!q) return;
  var matches = allNodeIds.filter(function(id) { return id.toLowerCase().includes(q); });
  matches.slice(0, 15).forEach(function(id) {
    var div = document.createElement('div');
    var idx = id.toLowerCase().indexOf(q);
    div.innerHTML = id.substring(0, idx)
      + '<span class="match">' + id.substring(idx, idx + q.length) + '</span>'
      + id.substring(idx + q.length);
    div.addEventListener('click', function() {
      var node = cy.getElementById(id);
      if (node.length) {
        selectNode(node);
        searchInput.value = id;
        searchResults.innerHTML = '';
      }
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
