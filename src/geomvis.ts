import * as $ from "jquery";
import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/js/all.min.js";
import * as SVG from "svg.js";
import "svg.draggable.js";
import "svg.draw.js";
import "svg.resize.js";
import "svg.select.js";
import "svg.select.js/dist/svg.select.css";
import { CohenSutherlandViz } from "./cohensutherland";
import "./deps/svg.topoly.js";
import { VizStep } from "./VizStep";
import { InputAction } from "./InputAction";
import { VizualizationBase } from "./VizualizationBase";

let theSVG: SVG.Doc;

let currentStep: number | null = null;

const undoStack: InputAction[] = [];
const redoStack: InputAction[] = [];

let steps: VizStep[] = [];
let currentVizStep = -1;

let viz: VizualizationBase;

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
            viz.loadFromString(fileContents);
        };
        reader.onerror = event => {
            // todo: better error
            (document.getElementById("pseudocodepanel") as HTMLDivElement).innerText = "Error reading file.";
        };
    }
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

export function computeSteps() {
    viz.setAllowEditing(false);
    steps = viz.computeSteps();
    (document.getElementById("backbutton") as HTMLButtonElement).disabled = false;
    (document.getElementById("playpausebutton") as HTMLButtonElement).disabled = false;
    (document.getElementById("forwardbutton") as HTMLButtonElement).disabled = false;
}

let discardModalConfirmAction: ((() => void) | null) = null;

export function discardModalConfirm() {
    if (discardModalConfirmAction !== null) {
        discardModalConfirmAction();
        discardModalConfirmAction = null;
    }
}

////////////////
// UI filling
////////////////
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
        exampleClone.querySelector("div")!.onclick = () => promptLoadExample(example.inputPath);

        if (example.name !== null)
            exampleClone.querySelector(".card-body")!.textContent = example.name;

        examplesContainer.appendChild(exampleClone);
    }

    // add to page
    document.querySelector("#algorithmAccordion")!.appendChild(clone);
}

function updateSVGViewbox() {
    theSVG.viewbox(
        //-document.getElementById("leftpane")!.offsetWidth // TODO: uncomment this after make left pane collapsible
    -500, -100, window.innerWidth, window.innerHeight);
}

export function onLoad() {
    // create the SVG
    theSVG = SVG("vizcontainer").size("100%", "100%").attr("id", "actualviz").attr("color", "#ffffff");
    theSVG.attr("preserveAspectRatio", "xMidYMid slice");
    window.addEventListener("resize", updateSVGViewbox);
    updateSVGViewbox();

    // add algorithms to left pane
    addAlgorithms();
    // show one
    $("#algoButton4").click();

    viz = new CohenSutherlandViz(theSVG);
    viz.setupCanvas(theSVG);
    viz.setupInput(theSVG);

    // setup hint text
    const hintText = document.getElementById("hinttext")!;
    hintText.textContent = viz.getHintText();

    // setup pseudo-code panel
    const pseudoCodePanel = document.getElementById("pseudocodepanel")!;
    viz.getPseudocode().forEach((line, index) => {
        const p = document.createElement("pre");
        p.textContent = line.code;
        p.classList.add("mb-0"); // remove bottom margin
        p.classList.add("pseudocode-line");
        pseudoCodePanel.appendChild(p);
    });
    updatePseudoCodeHighlight(null);
}

function addAlgorithms() {
    addAlgorithm("Convex Hull", "WIP", []);
    addAlgorithm("Line Segment Intersection", "WIP", []);
    addAlgorithm("Point in Polygon", "WIP", []);
    addAlgorithm("Cohen-Sutherland", "Clips lines into a polygon.", [
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
    addAlgorithm("Sutherland-Hodgman", "WIP", []);
}
