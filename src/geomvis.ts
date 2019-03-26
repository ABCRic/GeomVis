import * as $ from "jquery";
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/js/all.min.js";
import * as d3 from "d3";
import * as SVG from "svg.js";
import "svg.draggable.js";
import "svg.draw.js";
import "svg.resize.js";
import "svg.select.js";
import "svg.select.js/dist/svg.select.css";
import { pseudoCode, cohenSutherlandComputeSteps } from "./cohensutherland";
import "./deps/svg.topoly.js";
import { svgLineLength } from "./utils";
import { VizStep } from "./VizStep";
import * as cohenSutherlandExample from "!raw-loader!./inputs/cohen-sutherland-example.svg";

const LEFT_MOUSE_BUTTON = 0;

abstract class InputAction {
    public abstract undo(): void;
    public abstract redo(): void;
}

const undoStack: InputAction[] = [];
const redoStack: InputAction[] = [];

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
    undoButton.disabled = undoStack.length === 0;
    const redoButton = document.getElementById("redobutton") as HTMLButtonElement;
    redoButton.disabled = redoStack.length === 0;
}

function pushToUndoHistory(act: InputAction) {
    undoStack.push(act);
    redoStack.length = 0;
    updateUndoRedoButtons();
}

let theSVG: SVG.Doc;
let d3SVG: d3.Selection<d3.BaseType, {}, HTMLElement, any>;

let currentStep: number | null = null;

export function forward() {
    const oldStep = currentStep;

    // step out of current step
    if (steps[currentVizStep])
        steps[currentVizStep].stepToNext();

    // step into next step
    currentVizStep++;
    const newVizStep = steps[currentVizStep];
    newVizStep.stepFromPrevious();
    currentStep = newVizStep.codeLine;
    updatePseudoCodeHighlight(oldStep);
}

export function back() {
    const oldStep = currentStep;

    // step back out of current step
    if (steps[currentVizStep])
        steps[currentVizStep].stepToPrevious();

    // step into previous step
    currentVizStep--;
    const newStep = steps[currentVizStep];
    newStep.stepFromNext();
    currentStep = newStep.codeLine;
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
    document.getElementById("playpausebutton")!.innerHTML = "<i class=\"fas fa-pause\"></i> Pause";
}

function pause() {
    isPlaying = false;
    document.getElementById("playpausebutton")!.innerHTML = "<i class=\"fas fa-play\"></i> Play";
}

function updatePseudoCodeHighlight(oldStep: number | null) {
    const items = (document.getElementById("pseudocodepanel") as HTMLDivElement).childNodes as NodeListOf<HTMLPreElement>;
    if (oldStep !== null) {
        items[oldStep].classList.remove("pseudocode-currentline");
    }
    if (currentStep !== null) {
        items[currentStep].classList.add("pseudocode-currentline");
        const stepTextPanel = document.getElementById("steptextpanel") as HTMLDivElement;
        let text = pseudoCode[currentStep].stepText;
        if (steps[currentVizStep].extraText !== null)
            text += "<br>" + steps[currentVizStep].extraText;
        stepTextPanel.innerHTML = text;
    }
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

function loadExample(path: string) {
    console.log("Loading example from " + path);
    $("#loadingModal").modal("show");
    getFile(path, responseText => {
        loadFile(responseText);
        $("#loadingModal").on("shown.bs.modal",
            () => $("#loadingModal").modal("hide")
        ).modal("hide");
    });
}

function getFile(path: string, callback: (responseText: string) => void) {
    const client = new XMLHttpRequest();
    client.open("GET", path);
    client.onloadend = function() {
        callback(client.responseText);
    };
    client.send();
}

function loadFile(contents: string) {
    const doc = new DOMParser().parseFromString(contents, "image/svg+xml");
    const docRect = doc.getElementsByTagName("rect")[0];
    const docLines = doc.getElementsByTagName("line");
    const docPaths = doc.getElementsByTagName("path");

    // clear current lines
    lines.forEach(line => {
        line.remove();
    });
    lines.length = 0;

    // adapt our rect to first rect in document
    const adoptedRect = SVG.adopt(docRect);
    rect.attr("x", adoptedRect.x());
    rect.attr("y", adoptedRect.y());
    rect.attr("width", adoptedRect.width());
    rect.attr("height", adoptedRect.height());

    // fetch lines from document
    for (const line of docLines) {
        const adoptedLine = SVG.adopt(line) as SVG.Line;
        const points = adoptedLine.array().toLine();
        const newLine = theSVG.line(points.x1, points.y1, points.x2, points.y2).stroke("#000000");
        theSVG.add(newLine);
        lines.push(newLine);
    }

    // fetch paths from document and convert them into lines
    for (const path of docPaths) {
        const adoptedPath = SVG.adopt(path) as SVG.Path;
        const polyline = adoptedPath.toPoly() as SVG.PolyLine;

        const points = polyline.array().value as unknown as number[][];
        for (let i = 0; i < points.length - 1; i++) {
            const line = theSVG.line(
                points[i][0],
                points[i][1],
                points[i + 1][0],
                points[i + 1][1]
            ).stroke("#000000");
            lines.push(line);
        }
    }
    updateGuidelines();
}

let steps: VizStep[] = [];
let currentVizStep = -1;

export function computeSteps() {
    steps = cohenSutherlandComputeSteps(theSVG, rect, lines);
    (document.getElementById("backbutton") as HTMLButtonElement).disabled = false;
    (document.getElementById("playpausebutton") as HTMLButtonElement).disabled = false;
    (document.getElementById("forwardbutton") as HTMLButtonElement).disabled = false;
}

let discardModalConfirmAction: ((() => void) | null) = null;

export function defaultInput() {
    discardModalConfirmAction = () => {
        loadFile(cohenSutherlandExample);
    };
    $("#confirmDiscardModal").modal();
}

export function discardModalConfirm() {
    if (discardModalConfirmAction !== null) {
        discardModalConfirmAction();
        discardModalConfirmAction = null;
    }
}

let leftGuideline: SVG.Line;
let rightGuideline: SVG.Line;
let topGuideline: SVG.Line;
let bottomGuideline: SVG.Line;

function updateGuidelines() {
    const guidlinePadding = 10000;
    leftGuideline.plot(
        rect.x(),
        rect.y() + rect.height() + guidlinePadding,
        rect.x(),
        rect.y() - guidlinePadding);
    rightGuideline.plot(
        rect.x() + rect.width(),
        rect.y() + rect.height() + guidlinePadding,
        rect.x() + rect.width(),
        rect.y() - guidlinePadding);
    topGuideline.plot(
        rect.x() - guidlinePadding,
        rect.y(),
        rect.x() + rect.width() + guidlinePadding,
        rect.y());
    bottomGuideline.plot(
        rect.x() - guidlinePadding,
        rect.y() + rect.height(),
        rect.x() + rect.width() + guidlinePadding,
        rect.y() + rect.height());
}

let algorithmNum = 0;
function addAlgorithm(name: string, description: string, examples: AlgorithmExample[]) {
    const template = document.getElementById("algorithmTemplate") as HTMLTemplateElement;

    // instance algorithm template and fill
    algorithmNum++;
    const clone = document.importNode(template.content, true);
    clone.querySelector("#algoHeaderPlaceholder")!.id = "algoHeader" + algorithmNum;
    const algoButton = clone.querySelector("#algoButtonPlaceholder") as HTMLButtonElement;
    algoButton.id = "algoButton" + algorithmNum;
    algoButton.setAttribute("data-target", "#algoCollapse" + algorithmNum);
    algoButton.setAttribute("aria-controls", "#algoCollapse" + algorithmNum);
    algoButton.textContent = name;
    const algoCollapse = clone.querySelector("#algoCollapsePlaceholder") as HTMLDivElement;
    algoCollapse.id = "algoCollapse" + algorithmNum;
    algoCollapse.setAttribute("aria-labelledby", "algoHeader" + algorithmNum);
    const algoText = algoCollapse.querySelector("#algoText") as HTMLDivElement;
    algoText.textContent = description;

    // fill examples
    const exampleTemplate = document.getElementById("algoExampleTemplate") as HTMLTemplateElement;
    const examplesContainer = clone.querySelector("#algoExamplesContainer") as HTMLDivElement;
    for (const example of examples) {
        const exampleClone = document.importNode(exampleTemplate.content, true);

        exampleClone.querySelector("img")!.src = example.imagePath;
        exampleClone.querySelector("div")!.onclick = () => loadExample(example.inputPath);

        examplesContainer.appendChild(exampleClone);
    }

    // add to page
    document.querySelector("#algorithmAccordion")!.appendChild(clone);
}

export function onLoad() {
    // create the SVG
    theSVG = SVG("vizcontainer").size("100%", "100%").attr("id", "actualviz").attr("color", "#ffffff");
    console.log(theSVG);

    // fetch D3 object for it
    d3SVG = d3.select("#actualviz");

    // add algorithms to left pane
    addAlgorithm("Convex Hull", "WIP", []);
    addAlgorithm("Line Segment Intersection", "WIP", []);
    addAlgorithm("Point in Polygon", "WIP", []);
    addAlgorithm("Cohen-Sutherland", "Clips lines into a polygon.", [
        {
            imagePath: "inputs/cohensutherland/example1.png",
            inputPath: "inputs/cohensutherland/example1.svg"
        }
    ]);
    addAlgorithm("Sutherland-Hodgman", "WIP", []);

    // show one
    $("#algoButton4").click();

    // add resizable rect
    rect = theSVG.rect(200, 100).move(100, 100).fill("#fff");
    rect.selectize({rotationPoint: false});
    rect.resize();
    rect.draggable();

    // add region guidelines
    const guideLineStroke: SVG.StrokeData = {
        dasharray: "8",
        color: "black"
    };
    leftGuideline = theSVG
        .line(0, 0, 0, 0)
        .stroke(guideLineStroke);
    rightGuideline = theSVG
        .line(0, 0, 0, 0)
        .stroke(guideLineStroke);
    topGuideline = theSVG
        .line(0, 0, 0, 0)
        .stroke(guideLineStroke);
    bottomGuideline = theSVG
        .line(0, 0, 0, 0)
        .stroke(guideLineStroke);
    updateGuidelines();

    lines = [];

    {
        // setup rectangle event handling for undo/redo
        interface RectData {
            x: number;
            y: number;
            width: number;
            height: number;
        }
        class RectModifyAction extends InputAction {
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
                updateGuidelines();
            }
            public redo() {
                const adopted = SVG.adopt(this.target);
                adopted.attr("x", this.newData.x);
                adopted.attr("y", this.newData.y);
                adopted.attr("width", this.newData.width);
                adopted.attr("height", this.newData.height);
                updateGuidelines();
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
            updateGuidelines();
        });
        rect.on("resizedone", (event: any) => {
            pushToUndoHistory(new RectModifyAction(oldData, newData, event.target));
            updateGuidelines();
        });

        rect.on("beforedrag", function(this: SVG.Rect, event: any) {
            // drag only if shift is pressed
            if (!(event.detail.event as MouseEvent).shiftKey) {
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

        rect.on("dragmove", updateGuidelines);

        rect.on("dragend", function(this: SVG.Rect, event: any) {
            newData = {
                x: this.x(),
                y: this.y(),
                width: this.width(),
                height: this.height(),
            };
            updateGuidelines();
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

            // add ghost line for clicking
            line.attr("pointer-events", "none");
            const ghost = line.clone().stroke({width: 5, opacity: 0}).attr("pointer-events", "all").attr("cursor", "pointer") as SVG.Line;
            theSVG.add(ghost);

            // add to history
            pushToUndoHistory(new class extends InputAction {
                private path: SVG.Line;
                private ghostPath: SVG.Line;
                constructor(path: SVG.Line, ghostPath: SVG.Line) {
                    super();
                    this.path = path;
                    this.ghostPath = ghostPath;
                }
                public undo() {
                    this.path.remove();
                    this.ghostPath.remove();
                    lines.splice(lines.indexOf(this.path), 1);
                }
                public redo() {
                    theSVG.add(this.path);
                    theSVG.add(this.ghostPath);
                    lines.push(this.path);
                }
            }(line, ghost));

            {
                const deleteUndoEvent = new class extends InputAction {
                    private path: SVG.Line;
                    private ghostPath: SVG.Line;
                    constructor(path: SVG.Line, ghostPath: SVG.Line) {
                        super();
                        this.path = path;
                        this.ghostPath = ghostPath;
                    }
                    public undo() {
                        theSVG.add(this.path);
                        theSVG.add(this.ghostPath);
                        lines.push(this.path);
                    }
                    public redo() {
                        this.path.remove();
                        this.ghostPath.remove();
                        lines.splice(lines.indexOf(this.path), 1);
                    }
                }(line, ghost);

                ghost.on("mousedown", function(this: SVG.Line, event: any) {
                    deleteUndoEvent.redo();
                    pushToUndoHistory(deleteUndoEvent);
                });
            }

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
        pseudoCodePanel.appendChild(p);
    });
    updatePseudoCodeHighlight(null);
}
