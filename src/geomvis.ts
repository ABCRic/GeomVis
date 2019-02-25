import "svg.select.js/dist/svg.select.css";

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import * as d3 from "d3";
import { pseudoCode } from "./cohensutherland";
import * as SVG from "svg.js";

import "svg.select.js";
import "svg.resize.js";
import "svg.draggable.js";

let theSVG : SVG.Doc;
let d3SVG : d3.Selection<d3.BaseType, {}, HTMLElement, any>;

export function onLoad() {
    // create the SVG
    theSVG = SVG("vizcontainer").size("100%", "100%").attr("id", "actualviz").attr("color", "#ffffff");
    console.log(theSVG);

    // fetch D3 object for it
    d3SVG = d3.select("#actualviz");

    // draw some example circles
    /*const points = [
        {x: 10, y: 20},
        {x: 100, y: 50},
        {x: 200, y: 120},
        {x: 30, y: 80},
    ];
    d3SVG.selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("r", 10)
        .attr("fill", "purple")
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);*/

    // add box for capturing canvas clicks
    let clickBox = d3SVG.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "white")
        .attr("fill-opacity", 0)
        // with line drawing for cohen-sutherland
        .call(lineDraw);

    // add example resizable rect
    var rect = theSVG.rect(200,100).move(100,100).fill('#fff')
    rect.selectize({rotationPoint: false});
    rect.resize();
    rect.draggable();

    // setup pseudo-code panel
    let pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    pseudoCode.forEach(line => {
        let p = document.createElement("pre");
        p.textContent = line;
        p.classList.add("mb-0"); // remove bottom margin
        pseudoCodePanel.appendChild(p);
    });
}

function lineDraw(selection: any) {
    var xy0 : any, 
        path : any, 
        keep = false, 
        line = d3.line()
                 .x(d => d[0])
                 .y(d => d[1]);

    selection
        .on('mousedown', function(this: any){ 
            keep = true;
            xy0 = d3.mouse(this);
            path = d3SVG.append('path')
                     .attr('d', line([xy0, xy0]) as string)
                     .attr("stroke", "black")
                     .attr("stroke-width", "1px");
            console.log(path);
        })
        .on('mouseup', function(){ 
            keep = false;
        })
        .on('mousemove', function(this: any){ 
            if (keep) {
                let Line = line([xy0, d3.mouse(this).map(function(x){ return x - 1; })]);
                console.log(Line);
                console.log(path);
                path.attr('d', Line);
            }
        });
}