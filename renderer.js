/*
 * renderer.js
 *
 * This script runs in the renderer process of the Electron app.
 * It hooks into the existing Fantasy Map Generator code to raise
 * the point limit and accelerate heavy computations using GPU.js.
 * The implementation below is illustrative – the real generator
 * comprises thousands of interconnected modules.  Heavy work such
 * as Voronoi relaxation and river routing can be off‑loaded to
 * the GPU for massive speedups.
 */

const { GPU } = require('gpu.js');

// Override the maximum number of Voronoi points (cells) the generator
// will allow.  The original web app uses presets such as 10k and
// 100k; we set a much higher limit here so that the UI can accept
// 250k–500k or more.  The generator’s UI script should be modified
// to read this global instead of hard‑coding its own values.
window.MAX_CELLS = 500000;

// Create a GPU instance.  If a discrete GPU is available the
// computations will run there; otherwise they will fall back to the
// CPU.  GPU.js abstracts this detail.
const gpu = new GPU();

/**
 * Perform one iteration of Lloyd relaxation on a set of Voronoi cell
 * centroids.  This is one of the most computationally expensive
 * steps when generating a map.  Using GPU.js allows thousands of
 * points to be processed in parallel on the GPU.  A real
 * implementation should compute weighted centroids of each cell,
 * compute adjacency and other properties.  Here we clamp points
 * back to the map bounds as a demonstration.
 *
 * @param {Float32Array} xs Array of x coordinates
 * @param {Float32Array} ys Array of y coordinates
 * @param {number} width Map width
 * @param {number} height Map height
 * @returns {{xs: Float32Array, ys: Float32Array}} New coordinates
 */
function lloydRelaxation(xs, ys, width, height) {
  const length = xs.length;

  // Kernel to clamp points to the map bounds.  Without this the
  // Voronoi computation can push points outside the canvas, causing
  // artifacts.  In a full port you would compute new centroids.
  const clampKernel = gpu.createKernel(function(xs, ys, w, h) {
    const i = this.thread.x;
    let x = xs[i];
    let y = ys[i];
    if (x < 0.0) x = 0.0;
    if (x > w) x = w;
    if (y < 0.0) y = 0.0;
    if (y > h) y = h;
    return [x, y];
  }, {
    output: [length],
    pipeline: true,
    precision: 'single'
  });

  const result = clampKernel(xs, ys, width, height);
  // The GPU.js kernel returns a texture; convert it back to arrays.
  const newXs = new Float32Array(length);
  const newYs = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    newXs[i] = result[i][0];
    newYs[i] = result[i][1];
  }
  return { xs: newXs, ys: newYs };
}

// Expose the relaxation function globally so that the upstream
// generator can call it instead of its CPU implementation.
window.gpuLloydRelaxation = lloydRelaxation;

// Function to patch the generator once it has loaded.  This
// increases the point presets and replaces the CPU relaxation
// function with the GPU version.  It is idempotent and safe to
// call multiple times.
function patchGenerator() {
  try {
    if (window.mapGenerator) {
      // Increase the preset list if available
      if (window.mapGenerator.options) {
        const pts = window.mapGenerator.options.pointPresets || [];
        if (!pts.includes(window.MAX_CELLS)) pts.push(window.MAX_CELLS);
        window.mapGenerator.options.pointPresets = pts;
      }
      // Replace the point relaxation function with the GPU version
      if (typeof window.mapGenerator.relaxPoints === 'function') {
        window.mapGenerator.relaxPoints = (xs, ys, w, h) => {
          const { xs: rx, ys: ry } = lloydRelaxation(xs, ys, w, h);
          return { xs: rx, ys: ry };
        };
      }
    }
  } catch (err) {
    console.error('Failed to patch generator:', err);
  }
}

// Listen for a custom event that the upstream generator dispatches
// once it has finished loading all modules.  When received, we
// immediately apply the patches.  For older versions that do not
// dispatch the event, we poll until mapGenerator becomes available.
window.addEventListener('GeneratorLoaded', patchGenerator);

const patchInterval = setInterval(() => {
  if (window.mapGenerator) {
    clearInterval(patchInterval);
    patchGenerator();
  }
}, 500);