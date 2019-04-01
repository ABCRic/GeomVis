import * as $ from "jquery";
import * as SVG from "svg.js";
import { Line, Point, Rect } from "./geometrytypes";
import { VizStep } from "./VizStep";
import { linePoint1, linePoint2, svgLineLength } from "./utils";
import { SymmetricalVizAction } from "./SymmetricalVizAction";
import { EntryOnlyVizAction } from "./EntryOnlyVizAction";
import { InputAction } from "./InputAction";
import { LEFT_MOUSE_BUTTON } from "./constants";
import { PseudocodeLine } from "./PseudocodeLine";
import { VizualizationBase } from "./VizualizationBase";
import { pushToUndoHistory } from "./geomvis";

const pseudoCode: PseudocodeLine[] =
[{code: "for each line", stepText: "We take the following sequence of steps for each line we have to process. So we select any line we haven't selected yet."},
 {code: "  outcode1 = outcode(endpoint1)", stepText: "First, we check where one of the ends of the line is, and give it an outcode. Which end we choose first doesn't matter."},
 {code: "  outcode2 = outcode(endpoint2)", stepText: "Then we do the same for the other end of the line."},
 {code: "  if outcode1 | outcode2 == 0", stepText: "We check the outcodes: by using | (bitwise OR) we can quickly check if any of them have any bits set. Because the region of the clipping rectangle is all zeroes, if the result of the bitwise OR is zero then we know both ends of the line are inside the rectangle. Then we can trivially accept it."},
 {code: "    goto next line", stepText: "Since the whole line is inside the rectangle, we don't need to do anything and can start processing the next line."},
 {code: "  if outcode1 & outcode2 != 0", stepText: "We check the outcodes again: by using & (bitwise AND) we can compare every bit of the outcode, each corresponding to one outside zone. If both ends of the line are in the same zone, they will have a common bit set, which means the line is outside the rectangle. Then we can trivially reject it."},
 {code: "    delete line", stepText: "Since we detected the line was outside the rectangle, we remove it entirely."},
 {code: "    goto next line", stepText: "Then we start processing the next line."},
 {code: "  pick a point that's outside", stepText: "Since the line was neither fully inside nor fully outside, we need to clip an outside portion. Select an end point of the line that's outside. If both are outside, we can choose either one. We can check if an end point is outside by checking if its outcode is different than zero."},
 {code: "  replace it with the rectangle intersection point", stepText: "Use the straight line equation, Y = slope * X + base, to find the point of the line where it intersects with one of the region borders defined by the sides of the rectangle. Then we replace the point we chose with this new point."},
 {code: "  back to start of loop", stepText: "We've clipped a portion of the line, so now we have a new line. We go back to the start of the loop and process this new line."}];

const OUTCODE_INSIDE = 0;
const OUTCODE_LEFT = 1;
const OUTCODE_RIGHT = 2;
const OUTCODE_BOTTOM = 4;
const OUTCODE_TOP = 8;

function computeOutcode(rect: Rect, point: Point): number {
    let outcode = OUTCODE_INSIDE;

    if (point.x < rect.left)
        outcode = outcode || OUTCODE_LEFT;
    if (point.x > rect.right)
        outcode = outcode || OUTCODE_RIGHT;
    if (point.y < rect.top)
        outcode = outcode || OUTCODE_TOP;
    if (point.y > rect.bottom)
        outcode = outcode || OUTCODE_BOTTOM;

    return outcode;
}

function clipLine(rect: Rect, line: Line): (Line | null) {
    let outcode1 = computeOutcode(rect, line.p1);
    let outcode2 = computeOutcode(rect, line.p2);

    while (true) {
        if (outcode1 === 0 && outcode2 === 0) {
            // both endpoints inside
            return line;
        } else if ((outcode1 & outcode2) !== 0) {
            // endpoints share a specific outside region
            return null;
        } else {
            // at least one of the points is outside so we pick one that is
            let outsideOutcode: number;
            let choseOutcode1: boolean;
            if (outcode1 !== 0) {
                outsideOutcode = outcode1;
                choseOutcode1 = true;
            } else {
                outsideOutcode = outcode2;
                choseOutcode1 = false;
            }

            const newPoint = new Point(0, 0);

            // y = base + slope * x
            // slope = (y2 - y1) / (x2 - x1)
            // x = x1 + (1 / slope) * (yborder - y1) for top and bottom
            // y = y1 + slope * (xborder - x1) for left and right
            const slope = (line.p2.y - line.p1.y) / (line.p2.x - line.p1.x);
            if ((outsideOutcode & OUTCODE_TOP) !== 0) {
                newPoint.x = line.p1.x + (1 / slope) * (rect.top - line.p1.y);
                newPoint.y = rect.top;
            } else if ((outsideOutcode & OUTCODE_BOTTOM) !== 0) {
                newPoint.x = line.p1.x + (1 / slope) * (rect.bottom - line.p1.y);
                newPoint.y = rect.bottom;
            } else if ((outsideOutcode & OUTCODE_LEFT) !== 0) {
                newPoint.x = rect.left;
                newPoint.y = line.p1.y + slope * (rect.left - line.p1.x);
            } else if ((outsideOutcode & OUTCODE_RIGHT) !== 0) {
                newPoint.x = rect.right;
                newPoint.y = line.p1.y + slope * (rect.right - line.p1.x);
            }

            if (choseOutcode1) {
                line.p1 = newPoint;
                outcode1 = computeOutcode(rect, line.p1);
            } else {
                line.p2 = newPoint;
                outcode2 = computeOutcode(rect, line.p2);
            }
        }
    }
}

// explanation steps
// for each line
//   check where endpoint 1 is and associate outcode
//   check where endpoint 2 is and associate outcode
//   if trivial accept
//     next line
//   if trivial reject
//     delete line
//     next line
//   pick a point that's outside
//   clip it to the wall
//   back to start of loop
function cohenSutherland(rect: Rect, lines: Line[]) {
    lines.forEach(line => {
        clipLine(rect, line);
    });
}

function outcodeToString(outcode: number): string {
    const str = (outcode >>> 0).toString(2); // to binary string
    return "0000".substr(str.length) + str; // pad to four digits
}

/* Colors a line a given color, which sticks to the next steps. Takes an old color for backwards stepping.
 */
class ColorLineAction extends EntryOnlyVizAction {
    private line: SVG.Line;
    private fromColor: string;
    private toColor: string;

    constructor(canvas: SVG.Doc, line: SVG.Line, fromColor: string, toColor: string) {
        super(canvas);
        this.line = line;
        this.fromColor = fromColor;
        this.toColor = toColor;
    }

    public stepFromPrevious(): void {
        this.line.animate(250).stroke(this.toColor);
    }
    public stepToPrevious(): void {
        this.line.stroke(this.fromColor);
    }
}

class HighlightPointAction extends SymmetricalVizAction {
    private point: Point;
    private circle: SVG.Circle | null = null;

    constructor(canvas: SVG.Doc, point: Point) {
        super(canvas);
        this.point = point;
    }

    public enter(): void {
        this.circle = this.canvas.circle(25).center(this.point.x, this.point.y).fill("#29d8db");
        this.circle.animate(500, "<").size(7.5, 7.5);
    }
    public exit(): void {
        this.circle!.remove();
    }
}

class DeleteLineAction extends EntryOnlyVizAction {
    private line: SVG.Line;

    constructor(canvas: SVG.Doc, line: SVG.Line) {
        super(canvas);
        this.line = line;
    }
    public stepFromPrevious() {
        this.line.animate(500).attr("stroke-opacity", 0).after(() => this.line.remove());
    }
    public stepToPrevious() {
        this.canvas.add(this.line);
        this.line.attr("stroke-opacity", 1);
    }
}

export function cohenSutherlandComputeSteps(canvas: SVG.Doc, rect: SVG.Rect, lines: SVG.Line[]): VizStep[] {
    const rectData = new Rect(new Point(rect.x(), rect.y()), new Point(rect.x() + rect.width(), rect.y() + rect.height()));

    let steps: VizStep[] = [];
    steps.push(new VizStep(0));
    lines.forEach(line => {
        const lineData = new Line(linePoint1(line), linePoint2(line));

        // highlight the line
        const highlightLine = new VizStep(0);
        highlightLine.acts.push(new ColorLineAction(canvas, line, "#000000", "#29d8db"));
        steps.push(highlightLine);

        // add all the steps for the body of the loop of this line
        steps = steps.concat(generateStepsForLine(canvas, rectData, line, lineData));
    });
    return steps;
}

class ShowTextAction extends EntryOnlyVizAction {
    private point: Point;
    private text: string;
    private textElement: SVG.Text | undefined;

    constructor(canvas: SVG.Doc, point: Point, text: string) {
        super(canvas);
        this.point = point;
        this.text = text;
    }

    public stepFromPrevious(): void {
        this.textElement = this.canvas.text(this.text).x(this.point.x).y(this.point.y);
    }
    public stepToPrevious(): void {
        this.textElement!.remove();
    }
}

function generateStepsForLine(canvas: SVG.Doc, rectData: Rect, line: SVG.Line, lineData: Line): VizStep[] {
    const steps: VizStep[] = [];

    // highlight a point and show its outcode
    const highlightFirstPoint = new VizStep(1);
    const firstPointOutcode = computeOutcode(rectData, lineData.p1);
    highlightFirstPoint.extraText = "The outcode for this point is " + outcodeToString(firstPointOutcode);
    highlightFirstPoint.acts.push(new HighlightPointAction(canvas, lineData.p1));
    const showFirstOutpoint = new ShowTextAction(canvas, lineData.p1, outcodeToString(firstPointOutcode));
    highlightFirstPoint.acts.push(showFirstOutpoint);
    steps.push(highlightFirstPoint);

    // highlight the other point and show its outcode
    const highlightSecondPoint = new VizStep(2);
    const secondPointOutcode = computeOutcode(rectData, lineData.p2);
    highlightSecondPoint.extraText = "The outcode for this point is " + outcodeToString(secondPointOutcode);
    highlightSecondPoint.acts.push(new HighlightPointAction(canvas, lineData.p2));
    const showSecondOutpoint = new ShowTextAction(canvas, lineData.p2, outcodeToString(secondPointOutcode));
    highlightSecondPoint.acts.push(showSecondOutpoint);
    steps.push(highlightSecondPoint);

    // check for trivial accept
    const trivialAcceptCheck = new VizStep(3);
    trivialAcceptCheck.extraText = `The outcodes come out to ${outcodeToString(firstPointOutcode)} and ${outcodeToString(secondPointOutcode)}.<br>` +
                                    `The result of the bitwise OR is ${outcodeToString(firstPointOutcode | secondPointOutcode)}`;
    steps.push(trivialAcceptCheck);

    if ((firstPointOutcode | secondPointOutcode) === 0) {
        // we are accepting trivially - highlight acceptance and continue on to next line.
        const trivialAcceptPassed = new VizStep(4);
        trivialAcceptPassed.acts.push(new ColorLineAction(canvas, line, "#29d8db", "#00aa00"));
        trivialAcceptPassed.acts.push(showFirstOutpoint.getReverse());
        trivialAcceptPassed.acts.push(showSecondOutpoint.getReverse());
        steps.push(trivialAcceptPassed);
        return steps;
    }

    // check for trivial reject
    const trivialRejectCheck = new VizStep(5);
    trivialRejectCheck.extraText = `The outcodes come out to ${outcodeToString(firstPointOutcode)} and ${outcodeToString(secondPointOutcode)}.<br>` +
                                    `The result of the bitwise OR is ${outcodeToString(firstPointOutcode | secondPointOutcode)}`;
    steps.push(trivialRejectCheck);

    if ((firstPointOutcode & secondPointOutcode) !== 0) {
        // we are rejecting trivially - delete line
        const trivialRejectPassed = new VizStep(6);
        trivialRejectPassed.acts.push(new DeleteLineAction(canvas, line));
        steps.push(trivialRejectPassed);

        // continue on to next line
        const trivialRejectToNextLine = new VizStep(7);
        trivialRejectToNextLine.acts.push(showFirstOutpoint.getReverse());
        trivialRejectToNextLine.acts.push(showSecondOutpoint.getReverse());
        steps.push(trivialRejectToNextLine);
        return steps;
    }

    // at least one of the outcodes is outside. choose one of them
    let outsideOutcode: number;
    let choseOutcode1: boolean;
    if (firstPointOutcode !== 0) {
        outsideOutcode = firstPointOutcode;
        choseOutcode1 = true;
    } else {
        outsideOutcode = secondPointOutcode;
        choseOutcode1 = false;
    }

    // highlight the point we chose
    const highlightOutsidePoint = new VizStep(8);
    highlightOutsidePoint.acts.push(new HighlightPointAction(canvas, choseOutcode1 ? lineData.p1 : lineData.p2));
    steps.push(highlightOutsidePoint);

    // clip line
    const newPoint = new Point(0, 0);

    // y = base + slope * x
    // slope = (y2 - y1) / (x2 - x1)
    // x = x1 + (1 / slope) * (yborder - y1) for top and bottom
    // y = y1 + slope * (xborder - x1) for left and right
    const slope = (lineData.p2.y - lineData.p1.y) / (lineData.p2.x - lineData.p1.x);
    if ((outsideOutcode & OUTCODE_TOP) !== 0) {
        newPoint.x = lineData.p1.x + (1 / slope) * (rectData.top - lineData.p1.y);
        newPoint.y = rectData.top;
    } else if ((outsideOutcode & OUTCODE_BOTTOM) !== 0) {
        newPoint.x = lineData.p1.x + (1 / slope) * (rectData.bottom - lineData.p1.y);
        newPoint.y = rectData.bottom;
    } else if ((outsideOutcode & OUTCODE_LEFT) !== 0) {
        newPoint.x = rectData.left;
        newPoint.y = lineData.p1.y + slope * (rectData.left - lineData.p1.x);
    } else if ((outsideOutcode & OUTCODE_RIGHT) !== 0) {
        newPoint.x = rectData.right;
        newPoint.y = lineData.p1.y + slope * (rectData.right - lineData.p1.x);
    }

    const clipLineStep = new VizStep(9);
    const newLineData = choseOutcode1 ?
        new Line(newPoint, lineData.p2) :
        new Line(lineData.p1, newPoint);
    clipLineStep.acts.push(new ClipLineAction(canvas, line, lineData, newLineData));
    steps.push(clipLineStep);

    const backToStart = new VizStep(10);
    backToStart.acts.push(showFirstOutpoint.getReverse());
    backToStart.acts.push(showSecondOutpoint.getReverse());
    steps.push(backToStart);

    // return current iteration steps plus the steps for the next iteration over the line
    return steps.concat(generateStepsForLine(canvas, rectData, line, newLineData));
}

class ClipLineAction extends EntryOnlyVizAction {
    private line: SVG.Line;
    private lineData: Line;
    private newLineData: Line;

    constructor(canvas: SVG.Doc, line: SVG.Line, lineData: Line, newLineData: Line) {
        super(canvas);
        this.line = line;
        this.lineData = lineData;
        this.newLineData = newLineData;
    }

    public stepFromPrevious(): void {
        console.log(this.lineData);
        console.log(this.newLineData);
        this.line.plot(
            this.newLineData.p1.x,
            this.newLineData.p1.y,
            this.newLineData.p2.x,
            this.newLineData.p2.y
        );
    }
    public stepToPrevious(): void {
        this.line.plot(
            this.lineData.p1.x,
            this.lineData.p1.y,
            this.lineData.p2.x,
            this.lineData.p2.y
        );
    }
}

export class CohenSutherlandViz extends VizualizationBase {
    private rect!: SVG.Rect;
    private lines!: SVG.Line[];
    private leftGuideline!: SVG.Line;
    private rightGuideline!: SVG.Line;
    private topGuideline!: SVG.Line;
    private bottomGuideline!: SVG.Line;

    constructor(canvas: svgjs.Doc) {
        super(canvas);
    }

    public getPseudocode(): PseudocodeLine[] {
        return pseudoCode;
    }

    public getHintText(): string {
        return "Click and drag to draw lines; Click lines to remove them\n"
            + "Hold Shift and click and drag the rectangle to move it";
    }

    public setupCanvas(canvas: SVG.Doc) {
        // add resizable rect
        this.rect = canvas.rect(200, 100).move(100, 100).fill("#eee").stroke("#000");
        this.rect.selectize({rotationPoint: false});
        this.rect.resize();
        this.rect.draggable();

        // add region guidelines
        const guideLineStroke: SVG.StrokeData = {
            dasharray: "8",
            color: "black"
        };
        this.leftGuideline = canvas
            .line(0, 0, 0, 0)
            .stroke(guideLineStroke);
        this.rect.before(this.leftGuideline);
        this.rightGuideline = canvas
            .line(0, 0, 0, 0)
            .stroke(guideLineStroke);
        this.rect.before(this.rightGuideline);
        this.topGuideline = canvas
            .line(0, 0, 0, 0)
            .stroke(guideLineStroke);
        this.rect.before(this.topGuideline);
        this.bottomGuideline = canvas
            .line(0, 0, 0, 0)
            .stroke(guideLineStroke);
        this.rect.before(this.bottomGuideline);
        this.updateGuidelines();
    }

    public setupInput(canvas: SVG.Doc) {
        this.lines = [];

        // aliases for inner class scopes
        const updateGuidelinesFunc = this.updateGuidelines;
        const lines = this.lines;

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
                    updateGuidelinesFunc();
                }
                public redo() {
                    const adopted = SVG.adopt(this.target);
                    adopted.attr("x", this.newData.x);
                    adopted.attr("y", this.newData.y);
                    adopted.attr("width", this.newData.width);
                    adopted.attr("height", this.newData.height);
                    updateGuidelinesFunc();
                }
            }

            let oldData: RectData;
            let newData: RectData;
            this.rect.on("resizestart", (event: any) => {
                const adopted = SVG.adopt(event.target);
                oldData = {
                    x: adopted.x(),
                    y: adopted.y(),
                    width: adopted.width(),
                    height: adopted.height(),
                };
            });
            this.rect.on("resizing", (event: any) => {
                const adopted = SVG.adopt(event.target);
                newData = {
                    x: adopted.x(),
                    y: adopted.y(),
                    width: adopted.width(),
                    height: adopted.height(),
                };
                updateGuidelinesFunc();
            });
            this.rect.on("resizedone", (event: any) => {
                pushToUndoHistory(new RectModifyAction(oldData, newData, event.target));
                updateGuidelinesFunc();
            });

            this.rect.on("beforedrag", function(this: SVG.Rect, event: any) {
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

            this.rect.on("dragmove", this.updateGuidelines);

            this.rect.on("dragend", function(this: SVG.Rect, event: any) {
                newData = {
                    x: this.x(),
                    y: this.y(),
                    width: this.width(),
                    height: this.height(),
                };
                updateGuidelinesFunc();
                pushToUndoHistory(new RectModifyAction(oldData, newData, event.target));
            });
        }

        // setup line drawing
        {
            let line: SVG.Line | null;

            canvas.on("mousedown", (event: MouseEvent) => {
                if (!this.editingAllowed)
                    return;

                if (event.button !== LEFT_MOUSE_BUTTON)
                    return;

                // start drawing
                line = canvas.line(0, 0, 0, 0).stroke({ color: "black", width: 1 }).draw(event, {});
                return false;
            });
            canvas.on("mouseup", function(event: MouseEvent) {
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
                const ghost = line.clone().stroke({ width: 5, opacity: 0 }).attr("pointer-events", "all").attr("cursor", "pointer") as SVG.Line;
                canvas.add(ghost);

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
                        canvas.add(this.path);
                        canvas.add(this.ghostPath);
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
                            canvas.add(this.path);
                            canvas.add(this.ghostPath);
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
    }

    public loadFromString(contents: string) {
        const doc = new DOMParser().parseFromString(contents, "image/svg+xml");
        const docRect = doc.getElementsByTagName("rect")[0];
        const docLines = doc.getElementsByTagName("line");
        const docPaths = doc.getElementsByTagName("path");

        // clear current lines
        this.lines.forEach(line => {
            line.remove();
        });
        this.lines.length = 0;

        // adapt our rect to first rect in document
        const adoptedRect = SVG.adopt(docRect);
        this.rect.attr("x", adoptedRect.x());
        this.rect.attr("y", adoptedRect.y());
        this.rect.attr("width", adoptedRect.width());
        this.rect.attr("height", adoptedRect.height());

        // fetch lines from document
        for (const line of docLines) {
            const adoptedLine = SVG.adopt(line) as SVG.Line;
            const points = adoptedLine.array().toLine();
            const newLine = this.canvas.line(points.x1, points.y1, points.x2, points.y2).stroke("#000000");
            this.canvas.add(newLine);
            this.lines.push(newLine);
        }

        // fetch paths from document and convert them into lines
        for (const path of docPaths) {
            const adoptedPath = SVG.adopt(path) as SVG.Path;
            const polyline = adoptedPath.toPoly();

            const points = polyline.array().value as unknown as number[][];
            for (let i = 0; i < points.length - 1; i++) {
                const line = this.canvas.line(
                    points[i][0],
                    points[i][1],
                    points[i + 1][0],
                    points[i + 1][1]
                ).stroke("#000000");
                this.lines.push(line);
            }
        }
        this.updateGuidelines();
    }

    public updateGuidelines() {
        const guidlinePadding = 10000;
        this.leftGuideline.plot(
            this.rect.x(),
            this.rect.y() + this.rect.height() + guidlinePadding,
            this.rect.x(),
            this.rect.y() - guidlinePadding);
        this.rightGuideline.plot(
            this.rect.x() + this.rect.width(),
            this.rect.y() + this.rect.height() + guidlinePadding,
            this.rect.x() + this.rect.width(),
            this.rect.y() - guidlinePadding);
        this.topGuideline.plot(
            this.rect.x() - guidlinePadding,
            this.rect.y(),
            this.rect.x() + this.rect.width() + guidlinePadding,
            this.rect.y());
        this.bottomGuideline.plot(
            this.rect.x() - guidlinePadding,
            this.rect.y() + this.rect.height(),
            this.rect.x() + this.rect.width() + guidlinePadding,
            this.rect.y() + this.rect.height());
    }

    public onEnableEditing() {
        document.getElementById("topcontainer")!.style.display = "block";
        $("#topcontainer").animate({
            top: "10px"
        }, 500, "swing");
        this.rect.selectize({ rotationPoint: false });
    }

    public onDisableEditing() {
        $("#topcontainer").animate({
            top: "-200px"
        }, 500, "swing", function() {
            document.getElementById("topcontainer")!.style.display = "none";
        });
        this.rect.selectize(false);
    }

    public computeSteps() {
        return cohenSutherlandComputeSteps(this.canvas, this.rect, this.lines);
    }
}
