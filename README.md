### GeomVis is a visualization tool for helping in understanding algorithms from Computational Geometry.

# Building
NPM is required. Clone the repository and run `npm install` to install dependencies.

## Running/deploying
1. Build with `npx webpack`
2. Start a file server, e.g. the `http-server` NPM package, inside the dist/ folder.

## Development
Same as Running above but run webpack instead as `npx webpack --mode development --watch` for hot-reloading.

# Adding a new visualization
Visualizations are inside the `algorithms/` folder. To add a new visualization, create a new class derived from `VizualizationBase` and implement the required methods:

* `getPseudocode()`: list of lines of the code to be shown on the bottom panel. These are highlighted during execution.
* `getHintText()`: should return the hint text to be shown on the top during user input.
* `setupCanvas()` and `setupInput()`: perform canvas and input initialization for initial editing state, e.g. set up drawing lines with the mouse.
* `loadFromString()`: should parse input when the user selects a file and add everything that's necessary to the canvas.
* `onEnableEditing()` and `onDisableEditing()`: 
* `computeSteps()`: the meat of the visualization. When called, this should return a list of *steps*. Each *step* references a line of pseudocode and contains a list of *actions*. These *actions* are canvas transformations, such as adding a line, changing a circle's color, modifying text, and so on. Each *action* has four callbacks, representing forwards and backwards transitions to the previous and to the next steps. Some action types are included, such as `AddElementAction` and `TransformElementAction`. See the `computeSteps` method in the Convex Hull visualization for relatively simple examples of how to use actions.
  
  This function will be called once when the visualization starts and the interface will step through the returned list of steps for the duration of the visualization.

To add the visualization to the UI, along with a description and any examples, add it to the `addAlgorithms` function in `geomvis.ts`.

# Acknowledgements
GeomVis uses the following libraries:
* [svg.js](https://github.com/svgdotjs/svg.js), MIT License, and plugins:
  * [svg.draggable.js](https://github.com/svgdotjs/svg.draggable.js), MIT License
  * [svg.draw.js](https://github.com/svgdotjs/svg.draw.js), MIT License
  * [svg.resize.js](https://github.com/svgdotjs/svg.resize.js), MIT License
  * [svg.select.js](https://github.com/svgdotjs/svg.select.js), MIT License
  * [svg.topoly.js](https://github.com/svgdotjs/svg.topoly.js), MIT License
* [Bootstrap](https://github.com/twbs/bootstrap), MIT License
* [JQuery](https://github.com/jquery/jquery), MIT License
* [line-intersect](https://github.com/psalaets/line-intersect), MIT License
* [avl](https://github.com/w8r/avl), MIT License