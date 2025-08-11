# Fantasy Map Generator – GPU Edition

This folder contains a **prototype** of a desktop build of
[Azgaar’s Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator).
It wraps the original web application in an Electron shell and
demonstrates how one might raise the maximum number of map cells
while off‑loading heavy computations to the GPU using
[GPU.js](https://gpujs.com/).

**Important:** This is a minimal, illustrative example.  The real
generator comprises thousands of lines of code spread across
multiple modules.  To make it work with millions of cells you
would need to port its Voronoi generation, relaxation and routing
algorithms to the GPU and increase the UI presets.  This skeleton
shows where to hook into the app but does not implement the full
functionality.

## Files

* `package.json` — declares dependencies on Electron and GPU.js and
  defines a `start` script.
* `main.js` — launches an Electron window and loads the UI.
* `index.html` — placeholder HTML page; copy the contents of the
  upstream `index.html` here or load it through a build step to
  preserve the original look and feel.
* `renderer.js` — runs in the renderer process.  It sets a
  much higher cell limit (500 000) and replaces the generator’s
  CPU‑based Lloyd relaxation with a GPU‑accelerated stub using
  GPU.js.  The patch is applied either when a custom
  `GeneratorLoaded` event is dispatched or via polling.

## Usage

1. Ensure that Node.js and npm are installed.
2. Navigate to this directory and run `npm install` to install
   Electron and GPU.js.
3. Copy the upstream project’s `index.html` (and any other static
   assets such as images, CSS and SVG files) into this folder,
   replacing the placeholder markup.
4. Start the desktop app with `npm start`.  The application will
   open an Electron window containing the generator UI.  When it
   loads, `renderer.js` will increase the maximum point preset and
   use GPU.js for point relaxation.

## Notes

* The MIT licence of the original project allows you to modify and
  redistribute the software as long as you include the copyright
  notice and licence text【489949026262383†L4-L15】.
* An Electron build of the official generator already exists in the
  project’s releases【241346789159988†L20-L22】.  You may prefer to
  start from that build and apply the modifications described here.
* Processing 500 k+ cells still demands significant RAM and GPU
  resources.  On typical laptops the generator will remain slow.