#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

cat > "$OUTPUT" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Component Nudge Graph</title>
<script src="https://unpkg.com/cytoscape@3.30.4/dist/cytoscape.min.js"></script>
<style>
$(cat "$SCRIPT_DIR/nudge-graph.css")
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
var edgesData = ${edges_json};
$(cat "$SCRIPT_DIR/nudge-graph.js")
</script>
</body>
</html>
EOF

node_count=$(echo "$edges_json" | yq -p=json '[.[].src, .[].dst] | unique | length')
edge_count=$(echo "$edges_json" | yq -p=json 'length')
echo "Wrote $OUTPUT — $node_count nodes, $edge_count edges"
