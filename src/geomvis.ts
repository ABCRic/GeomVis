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
import { svgLineLength } from "./utils";

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

    updateUndoRedoButtons();
}

export function redo() {
    let act = redoStack.pop();
    console.log(act);
    if(!act) return;
    act.redo();
    undoStack.push(act);

    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    let undoButton = document.getElementById("undobutton") as HTMLButtonElement;
    undoButton!.disabled = undoStack.length == 0;
    let redoButton = document.getElementById("redobutton") as HTMLButtonElement;
    redoButton!.disabled = redoStack.length == 0;
}

function pushToUndoHistory(act: Action) {
    undoStack.push(act);
    redoStack.length = 0;
    updateUndoRedoButtons();
}

let theSVG : SVG.Doc;
let d3SVG : d3.Selection<d3.BaseType, {}, HTMLElement, any>;

let currentStep = 0;

export function forward() {
    let oldStep = currentStep;
    if(currentStep < pseudoCode.length - 1)
        currentStep++;
    updatePseudoCodeHighlight(oldStep);
}

export function back() {
    let oldStep = currentStep;
    if(currentStep > 0)
        currentStep--;
    updatePseudoCodeHighlight(oldStep);
}

export function playPause() {
    if(isPlaying) pause();
    else play();
}

let isPlaying = false;
function play() {
    isPlaying = true;
    var id = setInterval(iter, 800)
    function iter() {
        if(isPlaying) {
            forward();
        } else {
            clearInterval(id);
        }
    };
}

function pause() {
    isPlaying = false;
}

function updatePseudoCodeHighlight(oldStep: number) {
    let items = (document.getElementById("pseudocodepanel") as HTMLDivElement).childNodes as NodeListOf<HTMLPreElement>;
    items[oldStep].classList.remove("pseudocode-currentline");
    items[currentStep].classList.add("pseudocode-currentline");
}

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

            // ignore lines that are too small
            if(svgLineLength(line) < 8) {
                line.remove();
                return;
            }

            // add to history
            pushToUndoHistory(new class extends Action {
                path: SVG.Line;
                constructor(path: SVG.Line) {
                    super();
                    this.path = path;
                }
                undo() {
                    this.path.remove();
                }
                redo() {
                    theSVG.add(this.path);
                }
            }(line));
        });
    }

    // setup pseudo-code panel
    let pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    pseudoCode.forEach((line, index) => {
        let p = document.createElement("pre");
        p.textContent = line;
        p.classList.add("mb-0"); // remove bottom margin
        if(index == 0)
            p.classList.add("pseudocode-currentline");
        pseudoCodePanel.appendChild(p);
    });
}