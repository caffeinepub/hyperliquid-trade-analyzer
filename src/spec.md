# Specification

## Summary
**Goal:** Make Orderbook Heatmap (Cluster/triangle mode) triangle size changes feel smoother and slower by tying the visual transition speed to the selected Update Interval, and provide slower interval options by default.

**Planned changes:**
- Adjust the Cluster/triangle mode rendering so triangle size/shape transitions animate more gradually between snapshots, using an animation/transition duration derived from the currently selected Update Interval.
- Ensure the transition duration updates immediately when the user changes the Update Interval, while keeping snapshot polling cadence unchanged.
- Extend the Update Interval dropdown with slower options (at minimum 10s and 15s) and set the default Update Interval in `frontend/src/components/OrderbookHeatmapView.tsx` to a slower value (>= 5s), with English labels.

**User-visible outcome:** In Cluster mode, triangles grow/shrink smoothly (no per-second “jumping”), and users can select slower update intervals (including 10s and 15s) with a slower default experience.
