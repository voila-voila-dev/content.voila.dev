// Whether the environment can create a WebGL context — false during SSR and in
// happy-dom (no canvas/WebGL). Shared by the maplibre-backed surfaces (MapView,
// the geo edit widget) so their dynamic `import("maplibre-gl")` never runs where
// WebGL is unavailable.
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}
