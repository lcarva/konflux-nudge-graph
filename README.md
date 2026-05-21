# Nudge Graph

Interactive visualization of component nudge relationships in a Konflux tenant.

When a component is rebuilt, it can "nudge" other components to trigger their rebuilds.
This tool extracts those relationships from the `build-nudges-ref` spec field and renders
them as an interactive graph you can explore in a browser.

## Prerequisites

- [yq](https://github.com/mikefarah/yq) (v4+)
- `kubectl` or `oc` with access to the target namespace

## Fetching the data

Export the Component and Application resources from your namespace:

```bash
kubectl get components -n <namespace> -o yaml > components.yaml
kubectl get applications -n <namespace> -o yaml > applications.yaml
```

## Generating the graph

```bash
bash nudge-graph.sh [components.yaml] [output.html]
```

Both arguments are optional and default to `components.yaml` and `nudge-graph.html`.

Then open the output file in a browser.

## Interacting with the graph

- **Click a node** to highlight its full dependency chain. Downstream edges (what it
  nudges, transitively) are shown in orange; upstream edges (what nudges it) in green.
- **Search** for a component by name using the search box in the top-right corner.
  Click a result or press Enter to select the first match.
- **Click the background** to reset the view.
- **Scroll** to zoom, **drag** to pan.
