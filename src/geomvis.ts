import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import * as d3 from "d3";
import * as SVG from "svg.js";
import "svg.draggable.js";
import "svg.draw.js";
import "svg.resize.js";
import "svg.select.js";
import "svg.select.js/dist/svg.select.css";
import { pseudoCode } from "./cohensutherland";
import "./deps/svg.topoly.js";
import { svgLineLength } from "./utils";

const LEFT_MOUSE_BUTTON = 0;

abstract class Action {
    public abstract undo(): void;
    public abstract redo(): void;
}

const undoStack: Action[] = [];
const redoStack: Action[] = [];

export function undo() {
    const act = undoStack.pop();
    console.log(act);
    if (!act) return;
    act.undo();
    redoStack.push(act);

    updateUndoRedoButtons();
}

export function redo() {
    const act = redoStack.pop();
    console.log(act);
    if (!act) return;
    act.redo();
    undoStack.push(act);

    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoButton = document.getElementById("undobutton") as HTMLButtonElement;
    undoButton!.disabled = undoStack.length === 0;
    const redoButton = document.getElementById("redobutton") as HTMLButtonElement;
    redoButton!.disabled = redoStack.length === 0;
}

function pushToUndoHistory(act: Action) {
    undoStack.push(act);
    redoStack.length = 0;
    updateUndoRedoButtons();
}

let shiftDown = false;
function setShiftDown(event: KeyboardEvent) {
    if (event.keyCode === 16 || event.charCode === 16) {
        shiftDown = true;
    }
}

function setShiftUp(event: KeyboardEvent) {
    if (event.keyCode === 16 || event.charCode === 16) {
        shiftDown = false;
    }
}

let theSVG: SVG.Doc;
let d3SVG: d3.Selection<d3.BaseType, {}, HTMLElement, any>;

let currentStep = 0;

export function forward() {
    const oldStep = currentStep;
    if (currentStep < pseudoCode.length - 1)
        currentStep++;
    updatePseudoCodeHighlight(oldStep);
}

export function back() {
    const oldStep = currentStep;
    if (currentStep > 0)
        currentStep--;
    updatePseudoCodeHighlight(oldStep);
}

export function playPause() {
    if (isPlaying) pause();
    else play();
}

let isPlaying = false;
function play() {
    isPlaying = true;
    const id = setInterval(iter, 800);
    function iter() {
        if (isPlaying) {
            forward();
        } else {
            clearInterval(id);
        }
    }
}

function pause() {
    isPlaying = false;
}

function updatePseudoCodeHighlight(oldStep: number) {
    const items = (document.getElementById("pseudocodepanel") as HTMLDivElement).childNodes as NodeListOf<HTMLPreElement>;
    items[oldStep].classList.remove("pseudocode-currentline");
    items[currentStep].classList.add("pseudocode-currentline");
    const stepTextPanel = document.getElementById("steptextpanel") as HTMLDivElement;
    stepTextPanel.innerText = pseudoCode[currentStep].stepText;
}

export function fileSelected() {
    const file = ((document.getElementById("fileuploader") as HTMLInputElement).files || [null])[0];
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file); // result will be string in reader.result
        reader.onload = event => {
            const fileContents = reader.result as string;
            loadFile(fileContents);
        };
        reader.onerror = event => {
            // todo: better error
            (document.getElementById("pseudocodepanel") as HTMLDivElement).innerText = "Error reading file.";
        };
    }
}

let rect: SVG.Rect;
let lines: SVG.Line[];

function loadFile(contents: string) {
    const doc = new DOMParser().parseFromString(contents, "image/svg+xml");
    const docRect = doc.getElementsByTagName("rect")[0];
    const docLines = doc.getElementsByTagName("line");
    const docPaths = doc.getElementsByTagName("path");

    // todo: clear current document

    // adapt our rect to first rect in document
    const adoptedRect = SVG.adopt(docRect);
    rect.attr("x", adoptedRect.x());
    rect.attr("y", adoptedRect.y());
    rect.attr("width", adoptedRect.width());
    rect.attr("height", adoptedRect.height());

    // fetch lines from document
    for (const line of docLines) {
        const adoptedLine = SVG.adopt(line) as SVG.Line;
        theSVG.add(adoptedLine);
        lines.push(adoptedLine);
    }

    // fetch paths from document and convert them into lines
    for (const path of docPaths) {
        const adoptedPath = SVG.adopt(path) as SVG.Path;
        const polyline = adoptedPath.toPoly() as SVG.PolyLine;

        const points = polyline.array().value as unknown as number[][];
        for (let i = 0; i < points.length - 1; i++) {
            const x = new SVG.Array();
            const line = theSVG.line(
                points[i][0],
                points[i][1],
                points[i + 1][0],
                points[i + 1][1]
            ).stroke("#000000");
            lines.push(line);
        }
    }
}

export function onLoad() {
    // set up event handlers
    window.addEventListener("keydown", setShiftDown);
    window.addEventListener("keyup", setShiftUp);

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
    rect = theSVG.rect(200, 100).move(100, 100).fill("#fff");
    rect.selectize({rotationPoint: false});
    rect.resize();
    rect.draggable();

    lines = [];

    {
        // setup rectangle event handling for undo/redo
        interface RectData {
            x: number;
            y: number;
            width: number;
            height: number;
        }
        class RectModifyAction extends Action {
            private oldData: RectData;
            private newData: RectData;
            private target: SVGRectElement;
            constructor(oldData: RectData, newData: RectData, target: SVGRectElement) {
                super();
                this.oldData = oldData;
                this.newData = newData;
                this.target = target;
            }
            public undo() {
                const adopted = SVG.adopt(this.target);
                adopted.attr("x", this.oldData.x);
                adopted.attr("y", this.oldData.y);
                adopted.attr("width", this.oldData.width);
                adopted.attr("height", this.oldData.height);
            }
            public redo() {
                const adopted = SVG.adopt(this.target);
                adopted.attr("x", this.newData.x);
                adopted.attr("y", this.newData.y);
                adopted.attr("width", this.newData.width);
                adopted.attr("height", this.newData.height);
            }
        }

        let oldData: RectData;
        let newData: RectData;
        rect.on("resizestart", (event: any) => {
            const adopted = SVG.adopt(event.target);
            oldData = {
                x: adopted.x(),
                y: adopted.y(),
                width: adopted.width(),
                height: adopted.height(),
            };
        });
        rect.on("resizing", (event: any) => {
            const adopted = SVG.adopt(event.target);
            newData = {
                x: adopted.x(),
                y: adopted.y(),
                width: adopted.width(),
                height: adopted.height(),
            };
        });
        rect.on("resizedone", (event: any) => {
            pushToUndoHistory(new RectModifyAction(oldData, newData, event.target));
        });

        rect.on("beforedrag", function(this: SVG.Rect, event: any) {
            // drag only if shift is pressed
            if (!shiftDown) {
                event.preventDefault();
                return;
            }

            const adopted = SVG.adopt(event.target);
            oldData = {
                x: adopted.x(),
                y: adopted.y(),
                width: adopted.width(),
                height: adopted.height(),
            };
            oldData = {
                x: this.x(),
                y: this.y(),
                width: this.width(),
                height: this.height(),
            };
        });

        rect.on("dragend", function(this: SVG.Rect, event: any) {
            newData = {
                x: this.x(),
                y: this.y(),
                width: this.width(),
                height: this.height(),
            };
            pushToUndoHistory(new RectModifyAction(oldData, newData, event.target));
        });
    }

    // setup line drawing
    {
        let line: SVG.Line | null;

        theSVG.on("mousedown", function(event: MouseEvent) {
            if (event.button !== LEFT_MOUSE_BUTTON)
                return;

            // start drawing
            line = theSVG.line(0, 0, 0, 0).stroke({color: "black", width: 1}).draw(event, {});
            return false;
        });
        theSVG.on("mouseup", function(event: MouseEvent) {
            if (!line)
                return;

            // finish drawing
            line.draw("stop", event);

            // ignore lines that are too small
            if (svgLineLength(line) < 8) {
                line.remove();
                line = null;
                return;
            }

            // add to history
            pushToUndoHistory(new class extends Action {
                private path: SVG.Line;
                constructor(path: SVG.Line) {
                    super();
                    this.path = path;
                }
                public undo() {
                    this.path.remove();
                    lines.splice(lines.indexOf(this.path), 1);
                }
                public redo() {
                    theSVG.add(this.path);
                    lines.push(this.path);
                }
            }(line));

            lines.push(line);
            line = null;

            return false; // prevent propagation so we can listen globally to kill lines outside area
        });
        window.addEventListener("mouseup", event => {
            // mouse was released outside of drawing area. Discard our current line if we have one
            if (line) {
                line.draw("stop", event);
                line.remove();
                line = null;
            }
        });
    }

    // setup pseudo-code panel
    const pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    pseudoCode.forEach((line, index) => {
        const p = document.createElement("pre");
        p.textContent = line.code;
        p.classList.add("mb-0"); // remove bottom margin
        p.classList.add("pseudocode-line");
        if (index === 0)
            p.classList.add("pseudocode-currentline");
        pseudoCodePanel.appendChild(p);
    });
    updatePseudoCodeHighlight(0);
}
