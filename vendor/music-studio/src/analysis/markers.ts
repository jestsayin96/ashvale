export interface PlotMarker {
  t: number;
  label: string;
  type: string;
}

export interface MarkerLayout {
  x: number;
  label: string;
  type: string;
}

/** Map cue times onto a plot's x axis. Duration 0 keeps every marker on the left edge. */
export function layoutCueMarkers(markers: PlotMarker[], duration: number, plotLeft: number, plotWidth: number): MarkerLayout[] {
  const span = duration > 0 ? duration : 1;
  return markers.map((marker) => ({
    x: plotLeft + (Math.max(0, marker.t) / span) * plotWidth,
    label: marker.label || marker.type,
    type: marker.type,
  }));
}
