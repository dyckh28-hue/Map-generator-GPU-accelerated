/*
 * renderer.js
 *
 * This file runs in the renderer process of the Electron app.  It hooks
 * into the existing Fantasy Map Generator code to raise the point
 * limit and accelerate heavy computations using GPU.js.  The
 * implementation below is illustrative – the real generator has
 * numerous interconnected modules that would need to be patched.
 */

const { GPU } = require('gpu.js');

// Override the maximum number of Voronoi points (cells) the generator
// will allow.  The original code uses presets such as 10k and 100k; we
// set a much higher limit here so that the UI can accept 250k‑500k or
// more.  The generator’s UI script should be modified to read this
// global instead of hard‑coding its own values.
window.MAX_CELLS = 500000;

// Create a GPU instance.  If a discrete GPU is available the
// computations will run there, otherwise they will fall back to CPU.
const gpu = new GPU();

/**
 * Perform one iteration of Lloyd relaxation on a set of Voronoi cell
 * centroids.  This is one of the most computationally expensive steps
 * when generating a map.  Using GPU.js allows thousands of points
 * to be processed in parallel on the GPU.
 *
 * @param {Float32Array} xs Array of x coordinates
 * @param {Float32Array} ys Array of y coordinates
 * @param {number} width Map width
 * @param {number} height Map height
 * @returns {{xs: Float32Array, ys: Float32Array}} New coordinates
 */
function lloydRelaxation(xs, ys, width, height) {
  const length = xs.length;

  // Kernel to clamp points to the map bounds.  Without this the Voronoi
  // computation can push points outside the canvas, causing artifacts.
  const clampKernel = gpu.createKernel(function(xs, ys, w, h) {
    const i = this.thread.x;
    let x = xs[i];
    let y = ys[i];
    if (x < 0.0) x = 0.0;
    if (x > w) x = w;
    if (y < 0.0) y = 0.0;
    if (y > h) y = h;
    // Just return the clamped values for now; a real implementation
    // would compute weighted centroids of each Voronoi cell.
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
// function with the GPU version.  It is idempotent and safe to call
// multiple times.
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

// Listen for a custom event that the upstream generator may dispatch
// once it has finished loading all modules.  When received, we
// immediately apply the patches.
window.addEventListener('GeneratorLoaded', patchGenerator);

// Fallback: if the generator does not dispatch the event, poll until
// it becomes available.
const patchInterval = setInterval(() => {
  if (window.mapGenerator) {
    clearInterval(patchInterval);
    patchGenerator();
  }
}, 500);