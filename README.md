### GeomVis is a visualization tool for helping in understanding algorithms from Computational Geometry.

# Building
NPM is required. Clone the repository and run `npm install` to install dependencies.

## Running/deploying
1. Build with `npx webpack`
2. Start a file server, e.g. the `http-server` NPM package, inside the dist/ folder.

## Development
Same as Running above but run webpack instead as `npx webpack --mode development --watch` for hot-reloading.

# Acknoledgements
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