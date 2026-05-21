#!/usr/bin/env bash
set -euo pipefail

INPUT="${1:-components.yaml}"
OUTPUT="${2:-nudge-graph.html}"

if [[ ! -f "$INPUT" ]]; then
  echo "Usage: $0 [components.yaml] [output.html]" >&2
  exit 1
fi

edges_json=$(yq -o=json '
  [
    .items[]
    | select(.spec."build-nudges-ref" != null)
    | .metadata.name as $src
    | .spec."build-nudges-ref"[]
    | {"src": $src, "dst": .}
  ]
' "$INPUT")

cat > "$OUTPUT" <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Component Nudge Graph</title>
<script src="https://unpkg.com/cytoscape@3.30.4/dist/cytoscape.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; }
  #cy { width: 100%; height: 100vh; }
  #info {
    position: fixed; top: 12px; left: 12px; background: rgba(20,20,40,0.9);
    padding: 12px 16px; border-radius: 8px; font-size: 13px;
    max-width: 320px; line-height: 1.5; border: 1px solid #333;
  }
  #info h3 { margin-bottom: 4px; color: #7fbbf0; }
  #info .hint { color: #888; font-size: 12px; }
  #search {
    position: fixed; top: 12px; right: 12px; background: rgba(20,20,40,0.9);
    padding: 8px 12px; border-radius: 8px; border: 1px solid #333;
    display: flex; flex-direction: column; gap: 4px; min-width: 240px;
  }
  #search input {
    background: #2a2a4e; border: 1px solid #555; border-radius: 4px;
    color: #e0e0e0; padding: 6px 8px; font-size: 13px; outline: none;
    font-family: system-ui, sans-serif;
  }
  #search input:focus { border-color: #7fbbf0; }
  #search-results {
    max-height: 200px; overflow-y: auto; font-size: 12px;
  }
  #search-results div {
    padding: 3px 6px; border-radius: 3px; cursor: pointer;
  }
  #search-results div:hover { background: #3a3a5e; }
  #search-results .match { color: #7fbbf0; font-weight: bold; }
  #legend {
    position: fixed; bottom: 12px; left: 12px; background: rgba(20,20,40,0.9);
    padding: 10px 14px; border-radius: 8px; font-size: 12px;
    border: 1px solid #333; display: flex; gap: 16px;
  }
  #legend .item { display: flex; align-items: center; gap: 5px; }
  #legend .dot {
    width: 10px; height: 10px; border-radius: 50%; display: inline-block;
  }
</style>
</head>
<body>
<div id="cy"></div>
<div id="info">
  <h3 id="info-title">Component Nudge Graph</h3>
  <div id="info-body"><span class="hint">Click a node to highlight its connections.<br>Click background to reset.</span></div>
</div>
<div id="legend">
  <span class="item"><span class="dot" style="background:#96e6a1"></span> Source</span>
  <span class="item"><span class="dot" style="background:#ff8a80"></span> Sink</span>
  <span class="item"><span class="dot" style="background:#a78bfa"></span> Relay</span>
</div>
<div id="search">
  <input id="search-input" type="text" placeholder="Search components..." autocomplete="off">
  <div id="search-results"></div>
</div>
<script>
HTMLEOF

echo "var edgesData = $edges_json;" >> "$OUTPUT"

cat >> "$OUTPUT" <<'HTMLEOF'

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

// Search
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

</script>
</body>
</html>
HTMLEOF

node_count=$(echo "$edges_json" | yq -p=json '[.[].src, .[].dst] | unique | length')
edge_count=$(echo "$edges_json" | yq -p=json 'length')
echo "Wrote $OUTPUT — $node_count nodes, $edge_count edges"
