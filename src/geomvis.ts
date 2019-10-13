import $ from "jquery";
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/js/all.min.js";
import SVG from "svg.js";
import "svg.draggable.js";
import "svg.draw.js";
import "svg.resize.js";
import "svg.select.js";
import "svg.select.js/dist/svg.select.css";
import { CohenSutherlandViz } from "./algorithms/cohensutherland";
import "./deps/svg.topoly.js";
import { VizStep } from "./VizStep";
import { InputAction } from "./InputAction";
import { VizualizationBase } from "./VizualizationBase";
import { ConvexHullViz } from "./algorithms/convexhull";
import { classOf } from "./utils";
import { PointInPolygonViz } from "./algorithms/pointinpolygon";
import { SutherlandHodgmanViz } from "./algorithms/sutherlandhodgman";
import { LineSegmentIntersectionViz } from "./algorithms/linesegmentintersection";

let theSVG: SVG.Doc;

let currentStep: number | null = null;

const undoStack: InputAction[] = [];
const redoStack: InputAction[] = [];

let steps: VizStep[] = [];
let currentVizStep = -1;
let computed = false;
let playSpeed = 4500;

let viz: VizualizationBase;
let vizType: new (canvas: SVG.Doc) => VizualizationBase;

////////////////
// undo/redo methods
////////////////
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
    const redoButton = document.getElementById("redobutton") as HTMLButtonElement;
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
}

export function pushToUndoHistory(act: InputAction) {
    undoStack.push(act);
    redoStack.length = 0;
    updateUndoRedoButtons();
}

////////////////
// animation stepping methods
////////////////

export function uiNext() {
    // pause to avoid forward/back and autoplay going on at the same time
    pause();
    forward();
}

export function uiBack() {
    // pause to avoid forward/back and autoplay going on at the same time
    pause();
    back();
}

function forward() {
    if (!computed) computeSteps();

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
    updateStepButtons();
}

function back() {
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
    updateStepButtons();
}

export function playPause() {
    if (!computed) computeSteps();
    if (isPlaying) pause();
    else play();
}

let isPlaying = false;
let playCallbackHandle: number | null = null;
function play() {
    isPlaying = true;

    // run an iteration immediately
    iter();

    function iter() {
        // check if we're done
        if (currentVizStep >= steps.length) {
            pause();
            return;
        }

        if (isPlaying) {
            forward();
            playCallbackHandle = setTimeout(iter, playSpeed);
        }
    }
    document.getElementById("playpausebutton")!.innerHTML = "<i class=\"fas fa-pause\"></i> Pause";
}

function pause() {
    if (playCallbackHandle)
        clearTimeout(playCallbackHandle);
    isPlaying = false;
    document.getElementById("playpausebutton")!.innerHTML = "<i class=\"fas fa-play\"></i> Play";
}

function updateStepButtons() {
    const backButton = (document.getElementById("backbutton") as HTMLButtonElement);
    const forwardButton = (document.getElementById("forwardbutton") as HTMLButtonElement);

    backButton.disabled = false;
    forwardButton.disabled = false;

    if (currentVizStep === 0) {
        backButton.disabled = true;
    } else if (currentVizStep === steps.length - 1) {
        forwardButton.disabled = true;
    }
}

function updatePseudoCodeHighlight(oldStep: number | null) {
    const items = (document.getElementById("pseudocodepanel") as HTMLDivElement).childNodes as NodeListOf<HTMLPreElement>;
    if (oldStep !== null) {
        items[oldStep].classList.remove("pseudocode-currentline");
    }
    if (currentStep !== null) {
        items[currentStep].classList.add("pseudocode-currentline");
        const stepTextPanel = document.getElementById("steptextpanel") as HTMLDivElement;
        let text = viz.getPseudocode()[currentStep].stepText;
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
            activateVizualizer(classOf(viz)); // reset current viz
            viz.loadFromString(fileContents);
        };
        reader.onerror = event => {
            // todo: better error
            (document.getElementById("pseudocodepanel") as HTMLDivElement).innerText = "Error reading file.";
        };
    }
}

export function updateSpeed(value: number) {
    playSpeed = 4000 / (value / 100);
}

////////////////
// input loading methods
////////////////
function promptLoadExample(path: string) {
    discardModalConfirmAction = () => {
        loadExample(path);
    };
    $("#confirmDiscardModal").modal();
}

function loadExample(path: string) {
    console.log("Loading example from " + path);
    $("#loadingModal").modal("show");
    getFile(path, responseText => {
        activateVizualizer(classOf(viz)); // reset current viz
        viz.loadFromString(responseText);
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

function computeSteps() {
    viz.setAllowEditing(false);
    document.getElementById("vizcontainer")!.classList.remove("vizcontainer-editing");
    steps = viz.computeSteps();
    computed = true;
}

let discardModalConfirmAction: ((() => void) | null) = null;

export function discardModalConfirm() {
    if (discardModalConfirmAction !== null) {
        discardModalConfirmAction();
        discardModalConfirmAction = null;
    }
}

export function reset() {
    // reinstance current visualization type
    activateVizualizer(vizType);
}

////////////////
// UI filling
////////////////
let algorithmNum = 0;
function addAlgorithm(name: string, description: string, vizClass: new (canvas: SVG.Doc) => VizualizationBase, examples: AlgorithmExample[]) {
    const template = document.getElementById("algorithmTemplate") as HTMLTemplateElement;

    // instance algorithm template and fill
    algorithmNum++;
    const clone = document.importNode(template.content, true);
    clone.querySelector("#algoHeaderPlaceholder")!.id = "algoHeader" + algorithmNum;
    const algoButton = clone.querySelector("#algoButtonPlaceholder") as HTMLButtonElement;
    algoButton.id = "algoButton" + algorithmNum;
    algoButton.setAttribute("data-target", "#algoCollapse" + algorithmNum);
    algoButton.setAttribute("aria-controls", "#algoCollapse" + algorithmNum);
    algoButton.querySelector("#algoNamePlaceholder")!.textContent = name;
    algoButton.addEventListener("click", () => {
        activateVizualizer(vizClass);
    });
    const algoCollapse = clone.querySelector("#algoCollapsePlaceholder") as HTMLDivElement;
    algoCollapse.id = "algoCollapse" + algorithmNum;
    algoCollapse.setAttribute("aria-labelledby", "algoHeader" + algorithmNum);
    const algoText = algoCollapse.querySelector("#algoText") as HTMLDivElement;
    algoText.textContent = description;

    // configure algorithm collapse element
    const examplesContainer = clone.querySelector("#algoExamplesContainer") as HTMLDivElement;
    const algoExampleCollapse = clone.querySelector("#algoExamplesCollapse") as HTMLDivElement;
    algoExampleCollapse.setAttribute("data-target", "#algoExamplesContainer" + algorithmNum);
    algoExampleCollapse.setAttribute("aria-controls", "#algoExamplesContainer" + algorithmNum);

    // fill examples
    const exampleTemplate = document.getElementById("algoExampleTemplate") as HTMLTemplateElement;
    examplesContainer.id = "algoExamplesContainer" + algorithmNum;
    for (const example of examples) {
        const exampleClone = document.importNode(exampleTemplate.content, true);

        exampleClone.querySelector("img")!.src = example.imagePath;
        exampleClone.querySelector("div")!.onclick = () => promptLoadExample(example.inputPath);

        if (example.name !== null)
            exampleClone.querySelector(".card-body")!.textContent = example.name;

        examplesContainer.appendChild(exampleClone);
    }

    // add to page
    document.querySelector("#algorithmAccordion")!.appendChild(clone);
}

function resetViz() {
    computed = false;
    steps = [];
    currentVizStep = -1;
    currentStep = null;
    undoStack.length = 0;
    redoStack.length = 0;
    (document.getElementById("backbutton") as HTMLButtonElement).disabled = true;
    (document.getElementById("playpausebutton") as HTMLButtonElement).disabled = false;
    (document.getElementById("forwardbutton") as HTMLButtonElement).disabled = false;
    document.getElementById("vizcontainer")!.classList.add("vizcontainer-editing");
    document.getElementById("topcontainer")!.style.display = "block";
    $("#topcontainer").animate({
        top: "10px"
    }, 500, "swing");
    setUndoRedoAllowed(false);
}

function activateVizualizer(vizClass: new (canvas: SVG.Doc) => VizualizationBase) {
    resetViz();

    theSVG.remove();
    document.getElementById("vizcontainer")!.innerHTML = ""; // clear viz area (for visualizers that add HTML elements)
    createSVG();
    viz = new vizClass(theSVG);
    vizType = vizClass;
    viz.setupCanvas(theSVG);
    viz.setupInput(theSVG);

    // setup hint text
    setHintText(viz.getHintText());

    // setup pseudo-code panel
    const pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    // clear panel
    while (pseudoCodePanel.firstChild) pseudoCodePanel.removeChild(pseudoCodePanel.firstChild);
    viz.getPseudocode().forEach((line, index) => {
        const p = document.createElement("pre");
        p.textContent = line.code.length > 0 ? line.code : " "; // force blank line if string empty (empty string makes html element have 0 height)
        p.classList.add("mb-0"); // remove bottom margin
        p.classList.add("pseudocode-line");
        pseudoCodePanel.appendChild(p);
    });
    updatePseudoCodeHighlight(null);
    pause();
}

function updateSVGViewbox() {
    theSVG.viewbox(
        //-document.getElementById("leftpane")!.offsetWidth // TODO: uncomment this after make left pane collapsible
    -500, -100, window.innerWidth, window.innerHeight);
}

function createSVG() {
    theSVG = SVG("vizcontainer").size("100%", "100%").attr("id", "actualviz").attr("color", "#ffffff");
    theSVG.attr("preserveAspectRatio", "xMidYMid slice");
    updateSVGViewbox();
}

////////////////
// APIs to be called by vizualizations (via VizualizationBase)
////////////////
export function setHintText(text: string) {
    const hintText = document.getElementById("hinttext")!;
    hintText.textContent = text;
}

export function setUndoRedoAllowed(allowed: boolean) {
    const undoButton = document.getElementById("undobutton") as HTMLButtonElement;
    const redoButton = document.getElementById("redobutton") as HTMLButtonElement;
    undoButton.style.display = allowed ? null : "none";
    redoButton.style.display = allowed ? null : "none";
}

export function onLoad() {
    createSVG();
    window.addEventListener("resize", updateSVGViewbox);

    // add algorithms to left pane
    addAlgorithms();
    // show one
    $("#algoButton1").click();
    // add hotkeys
    window.addEventListener("keydown", globalKeyDownHandler);
}

function globalKeyDownHandler(this: Window, ev: KeyboardEvent) {
    if (ev.key === "ArrowLeft") { // left arrow to step back
        back();
        ev.preventDefault();
    } else if (ev.key === "ArrowRight") { // right arrow to step forward
        forward();
        ev.preventDefault();
    } else if (ev.key === " ") { // spacebar to play/pause
        playPause();
        ev.preventDefault();
    }
}

function addAlgorithms() {
    addAlgorithm("Convex Hull - Graham scan",
`A convex hull of points is the smallest convex set of points that contains them. You can visualize it as the shape enclosed by a rubber band stretched around the points.
Graham scan is an O(n log n) algorithm for finding a convex hull. The algorithm was originally published by Ronald Graham in 1972.`, ConvexHullViz, [
        {
            imagePath: "inputs/convexhull/example1.png",
            inputPath: "inputs/convexhull/example1.svg",
            name: "Example 1"
        },
        {
            imagePath: "inputs/convexhull/example2.png",
            inputPath: "inputs/convexhull/example2.svg",
            name: "Example 2"
        },
        {
            imagePath: "inputs/convexhull/example3.png",
            inputPath: "inputs/convexhull/example3.svg",
            name: "Example 3"
        }
    ]);
    addAlgorithm("Point in Polygon",
`A Point in Polygon algorithm takes a polygon and a point and determines if the point is inside the polygon.
There are several ways to this - the algorithm shown here uses the winding number of the point with respect to the polygon, which corresponds to the total number of times the outline of the polygon travels counterclockwise around the point. If the number is zero, the point must be outside, otherwise it must be inside.
This algorithm is used in technologies such as SVG, which powers this visualization.`, PointInPolygonViz, [
    {
        imagePath: "inputs/pointinpolygon/example1.png",
        inputPath: "inputs/pointinpolygon/example1.svg",
        name: "Example 1"
    },
    {
        imagePath: "inputs/pointinpolygon/example2.png",
        inputPath: "inputs/pointinpolygon/example2.svg",
        name: "Example 2"
    },
    {
        imagePath: "inputs/pointinpolygon/example3.png",
        inputPath: "inputs/pointinpolygon/example3.svg",
        name: "Example 3"
    },
]);
    addAlgorithm("Cohen-Sutherland",
`Line clipping is the process of removing lines or portions of lines outside an area.
The Cohen-Sutherland algorithm was developed in 1967 by Danny Cohen and Ivan Sutherland. It clips lines into a rectangle by dividing a two-dimensional space into 9 regions and then determining which lines and portions of lines are visible in the central region.`, CohenSutherlandViz, [
        {
            imagePath: "inputs/cohensutherland/example1.png",
            inputPath: "inputs/cohensutherland/example1.svg",
            name: "Example 1"
        },
        {
            imagePath: "inputs/cohensutherland/example2.png",
            inputPath: "inputs/cohensutherland/example2.svg",
            name: "Example 2"
        },
        {
            imagePath: "inputs/cohensutherland/example3.png",
            inputPath: "inputs/cohensutherland/example3.svg",
            name: "Example 3"
        },
        {
            imagePath: "inputs/cohensutherland/example4.png",
            inputPath: "inputs/cohensutherland/example4.svg",
            name: "Example 4"
        },
        {
            imagePath: "inputs/cohensutherland/example5.png",
            inputPath: "inputs/cohensutherland/example5.svg",
            name: "Example 5"
        },
        {
            imagePath: "inputs/cohensutherland/example6.png",
            inputPath: "inputs/cohensutherland/example6.svg",
            name: "Example 6"
        }
    ]);
    addAlgorithm("Sutherland-Hodgman",
`The Sutherland-Hodgman algorithm clips input polygons so that they fit inside a given clip polygon. Polygon clipping is used in computer graphics, for example, to discard unused portions of polygons to save rendering work.
The algorithm extends each edge of the clip polygon and then clips the input polygons against it; this process is then repeated for each edge. The end product is a copy of the original input polygon clipped against the clip polygon.`, SutherlandHodgmanViz, [
    {
        imagePath: "inputs/sutherlandhodgman/example1.png",
        inputPath: "inputs/sutherlandhodgman/example1.svg",
        name: "Example 1"
    },
    {
        imagePath: "inputs/sutherlandhodgman/example2.png",
        inputPath: "inputs/sutherlandhodgman/example2.svg",
        name: "Example 2"
    },
    {
        imagePath: "inputs/sutherlandhodgman/example3.png",
        inputPath: "inputs/sutherlandhodgman/example3.svg",
        name: "Example 3"
    },
    {
        imagePath: "inputs/sutherlandhodgman/example4.png",
        inputPath: "inputs/sutherlandhodgman/example4.svg",
        name: "Example 4"
    },
]);
    addAlgorithm("Line Segment Intersection - Bentley-Ottmann",
`A Line Segment Intersection algorithm takes a set of line segments and finds the points where those line segments intersect.
The Bentley-Ottman algorithm shown here uses a sweep line approach, running a vertical line from left to right across the plane to find intersections.
The simple aproach is to test every line, which takes O(n²) time, where n is the number of lines. This algorithm maintains a tree of active lines when sweeping which reduces the complexity to O((n+k) log n), where n and k are the number of lines and crossings respectively. Thus it is much faster in cases with few crossings.`, LineSegmentIntersectionViz, [
    {
        imagePath: "inputs/linesegmentintersection/example1.png",
        inputPath: "inputs/linesegmentintersection/example1.svg",
        name: "Example 1"
    },
]);
}
