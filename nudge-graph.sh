#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<USAGE
Usage: $0 [options] [components.yaml] [output.html]

Options:
  --catalog FILE   Catalog/CVE data (.yaml, .json or .csv) with the columns
                   component, repository, grade, openCves
  --export FILE    Also write the graph as machine-readable JSON
  --theme NAME     Initial theme: dark (default) or light
USAGE
  exit 1
}

CATALOG=""
EXPORT=""
THEME="dark"
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --catalog) [[ $# -ge 2 ]] || usage; CATALOG="$2"; shift 2 ;;
    --export)  [[ $# -ge 2 ]] || usage; EXPORT="$2"; shift 2 ;;
    --theme)   [[ $# -ge 2 ]] || usage; THEME="$2"; shift 2 ;;
    -h|--help) usage ;;
    -*)        echo "Unknown option: $1" >&2; usage ;;
    *)         POSITIONAL+=("$1"); shift ;;
  esac
done

[[ "$THEME" == "dark" || "$THEME" == "light" ]] || { echo "--theme must be dark or light" >&2; exit 1; }

INPUT="${POSITIONAL[0]:-components.yaml}"
OUTPUT="${POSITIONAL[1]:-nudge-graph.html}"

if [[ ! -f "$INPUT" ]]; then
  usage
fi

edges_json=$(yq -o=json -I=0 '
  [
    .items[]
    | select(.spec."build-nudges-ref" != null)
    | .metadata.name as $src
    | .spec."build-nudges-ref"[]
    | {"src": $src, "dst": .}
  ]
' "$INPUT")

catalog_json='[]'
if [[ -n "$CATALOG" ]]; then
  [[ -f "$CATALOG" ]] || { echo "Catalog file not found: $CATALOG" >&2; exit 1; }
  if [[ "$CATALOG" == *.csv ]]; then
    catalog_json=$(yq -p=csv -o=json -I=0 '.' "$CATALOG")
  else
    catalog_json=$(yq -o=json -I=0 '.' "$CATALOG")
  fi
fi

# Streams are the -vX-Y suffix of a component name; everything else is "main".
graph_json=$(EDGES="$edges_json" CATALOG="$catalog_json" yq -n -o=json -I=0 '
  env(EDGES) as $edges
  | env(CATALOG) as $cat
  | ($edges | map(.src) | unique) as $srcs
  | ($edges | map(.dst) | unique) as $dsts
  | (($srcs + $dsts) | unique | sort) as $names
  | ($names | map(
      . as $n
      | ($srcs | map(select(. == $n)) | length) as $out
      | ($dsts | map(select(. == $n)) | length) as $in
      | ($cat | map(select(.component == $n)) | .[0]) as $c
      | {
          "id": $n,
          "stream": ((select(test("-v[0-9]+-[0-9]+$")) | sub(".*-(v[0-9]+-[0-9]+)$", "$1")) // "main"),
          "role": (["sink", "source", "relay"] | .[$out + $in * $out]),
          "repository": ((($c | .repository) | select(. != null and . != "")) // null),
          "grade": ((($c | .grade) | select(. != null and . != "") | upcase) // null),
          "openCves": ((($c | .openCves) | select(. != null and . != "") | to_number) // null)
        }
    )) as $nodes
  | {
      "version": 1,
      "streams": ($nodes | map(.stream) | unique | sort),
      "nodes": $nodes,
      "edges": ($edges | sort_by(.src, .dst)),
      "repositories": (
        $cat
        | map(select(.component != null and .repository != null and .repository != ""))
        | map({"key": .component, "value": .repository})
        | from_entries
      )
    }
')

if [[ -n "$EXPORT" ]]; then
  echo "$graph_json" | yq -p=json -o=json '.' > "$EXPORT"
  echo "Wrote $EXPORT"
fi

# Keep user-supplied strings from closing the inline <script> block.
graph_json_html="${graph_json//</\\u003c}"

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
<div id="legend"></div>
<div id="side">
  <div id="search">
    <input id="search-input" type="text" placeholder="Search components..." autocomplete="off">
    <div id="search-results"></div>
  </div>
  <div id="controls">
    <div class="row">
      <label for="color-mode">Colour by</label>
      <select id="color-mode">
        <option value="role">Role</option>
        <option value="grade">Catalog grade</option>
        <option value="cves">Open CVEs</option>
      </select>
    </div>
    <div class="row"><span>Streams</span><span id="stream-filter"></span></div>
    <div class="row buttons">
      <button id="theme-toggle" type="button"></button>
      <button id="export-json" type="button">Export JSON</button>
    </div>
  </div>
</div>
<script>
var graphData = ${graph_json_html};
var defaultTheme = "${THEME}";
$(cat "$SCRIPT_DIR/nudge-graph.js")
</script>
</body>
</html>
EOF

node_count=$(echo "$graph_json" | yq -p=json '.nodes | length')
edge_count=$(echo "$graph_json" | yq -p=json '.edges | length')
echo "Wrote $OUTPUT — $node_count nodes, $edge_count edges"
if [[ -n "$CATALOG" ]]; then
  matched=$(echo "$graph_json" | yq -p=json '[.nodes[] | select(.repository != null or .grade != null or .openCves != null)] | length')
  echo "Catalog matched $matched of $node_count nodes"
fi
