# Nudge Graph

Interactive visualization of component nudge relationships in a Konflux tenant.

When a component is rebuilt, it can "nudge" other components to trigger their rebuilds.
This tool extracts those relationships from the `build-nudges-ref` spec field and renders
them as an interactive graph you can explore in a browser.

## Prerequisites

- [yq](https://github.com/mikefarah/yq) (v4+)
- `kubectl` or `oc` with access to the target namespace

## Fetching the data

Export the Component resources from your namespace:

```bash
kubectl get components -n <namespace> -o yaml > components.yaml
```

## Generating the graph

```bash
bash nudge-graph.sh [--catalog catalog.csv] [--export graph.json] [--theme dark|light] [components.yaml] [output.html]
```

The positional arguments default to `components.yaml` and `nudge-graph.html`.

Then open the output file in a browser.

## Catalog data (optional)

`--catalog` takes a `.csv`, `.yaml` or `.json` file with one row per component:

```csv
component,repository,grade,openCves
cosign,registry.redhat.io/rhtas/cosign-rhel9,B,3
rhtas-operator,registry.redhat.io/rhtas/rhtas-rhel9-operator,C,5
```

Components missing from the file are shown as "Not in catalog". With a catalog loaded the
graph is coloured by grade by default.

## Machine-readable export

`--export graph.json` (or the **Export JSON** button in the page) writes:

```json
{
  "version": 1,
  "streams": ["main", "v1-3"],
  "nodes": [{"id": "cosign", "stream": "main", "role": "source", "repository": "registry.redhat.io/rhtas/cosign-rhel9", "grade": "B", "openCves": 3}],
  "edges": [{"src": "cosign", "dst": "cosign-cli-stack"}],
  "repositories": {"cosign": "registry.redhat.io/rhtas/cosign-rhel9"}
}
```

`src` nudges `dst`. A component's stream is its `-vX-Y` name suffix, or `main` without one.
`role` is `source`, `relay` or `sink`.

## Interacting with the graph

- **Swimlanes**: one lane per stream, with nudge depth running left to right. Use the
  **Streams** checkboxes to show or hide lanes.
- **Colour by** role, catalog grade or open CVE count. In CVE mode, node size also grows
  with the count.
- **Click a node** to highlight its full dependency chain. Downstream edges (what it
  nudges, transitively) are shown in orange; upstream edges (what nudges it) in green.
- **Rebuild preview**: selecting a sink (leaf image) shows how many builds it takes to fix
  every upstream component with open CVEs one at a time (naive) versus landing all fixes
  and rebuilding each image once (batched). Without CVE data, every upstream component
  is counted.
- **Light/Dark background** button switches the theme; the choice is remembered.
- **Search** for a component by name using the search box in the top-right corner.
  Click a result or press Enter to select the first match.
- **Click the background** to reset the view.
- **Scroll** to zoom, **drag** to pan.
