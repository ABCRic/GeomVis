import "svg.select.js/dist/svg.select.css";

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

import * as d3 from "d3";
import { pseudoCode } from "./cohensutherland";
import * as SVG from "svg.js";

import "svg.select.js";
import "svg.resize.js";
import "svg.draggable.js";
import "svg.draw.js";

abstract class Action {
    abstract undo() : void;
    abstract redo() : void;
}

let undoStack : Action[] = [];
let redoStack : Action[] = [];

export function undo() {
    let act = undoStack.pop();
    console.log(act);
    if(!act) return;
    act.undo();
    redoStack.push(act);
}

export function redo() {
    let act = redoStack.pop();
    console.log(act);
    if(!act) return;
    act.redo();
    undoStack.push(act);
}

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

    // // add box for capturing canvas clicks
    // let clickBox = d3SVG.append("rect")
    //     .attr("x", 0)
    //     .attr("y", 0)
    //     .attr("width", "100%")
    //     .attr("height", "100%")
    //     .attr("fill", "white")
    //     .attr("fill-opacity", 0)
    //     // with line drawing for cohen-sutherland
    //     .call(lineDraw);

    // add example resizable rect
    var rect = theSVG.rect(200,100).move(100,100).fill('#fff')
    rect.selectize({rotationPoint: false});
    rect.resize();
    rect.draggable();

    // setup line drawing
    {
        let line : SVG.Line;

        theSVG.on('mousedown', function(event) {
            // start drawing
            line = theSVG.line(0,0,0,0).stroke({color: "black", width: 1}).draw(event, {});
        });
        theSVG.on('mouseup', function(event){
            // finish drawing
            line.draw("stop", event);

            // add to history
            undoStack.push(new class extends Action {
                path: SVG.Line;
                constructor(path: SVG.Line) {
                    super();
                    this.path = path;
                }
                undo() {
                    line.remove();
                }
                redo() {
                    theSVG.add(line);
                }
            }(line));
        });
    }

    // setup pseudo-code panel
    let pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    pseudoCode.forEach(line => {
        let p = document.createElement("pre");
        p.textContent = line;
        p.classList.add("mb-0"); // remove bottom margin
        pseudoCodePanel.appendChild(p);
    });
}