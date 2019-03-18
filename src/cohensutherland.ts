import * as SVG from "svg.js";
import { Line, Point, Rect } from "./geometrytypes";
import { VizStep } from "./VizStep";
import { linePoint1, linePoint2 } from "./utils";
import { SymmetricalVizAction } from "./SymmetricalVizAction";
import { EntryOnlyVizAction } from "./EntryOnlyVizAction";

export const pseudoCode =
[{code: "for each line", stepText: "We take the following sequence of steps for each line we have to process. So we select any line we haven't selected yet."},
 {code: "  outcode1 = outcode(endpoint1)", stepText: "First, we check where one of the ends of the line is, and give it an outcode. Which end we choose first doesn't matter."},
 {code: "  outcode2 = outcode(endpoint2)", stepText: "Then we do the same for the other end of the line."},
 {code: "  if outcode1 | outcode2 == 0", stepText: "We check the outcodes: by using | (bitwise OR) we can quickly check if any of them have any bits set. Because the region of the clipping rectangle is all zeroes, if the result of the bitwise OR is zero then we know both ends of the line are inside the rectangle. Then we can trivially accept it."},
 {code: "    goto next line", stepText: "Since the whole line is inside the rectangle, we don't know to do anything and can start processing the next line."},
 {code: "  if outcode1 & outcode2 != 0", stepText: "We check the outcodes again: by using & (bitwise AND) we can compare every bit of the outcode, each corresponding to one outside zone. If both ends of the line are in the same zone, they will have a common bit set, which means the line is outside the rectangle. Then we can trivially reject it."},
 {code: "    delete line", stepText: "Since we detected the line was outside the rectangle, we remove it entirely."},
 {code: "    goto next line", stepText: "Then we start processing the next line."},
 {code: "  pick a point that's outside", stepText: "Since the line was neither fully inside nor fully outside, we need to clip an outside portion. Select an end point of the line that's outside. If both are outside, we can choose either one. We can check if an end point is outside by checking if its outcode is different than zero."},
 {code: "  replace it with the rectangle intersection point", stepText: "Use the straight line equation, Y = slope * X + base, to find the point of the line where it intersects the sides of the rectangle. We do this for both the X and Y axes. Then we replace the point we chose with this new point."},
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
        this.line.stroke(this.toColor);
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
        this.circle = this.canvas.circle(5).center(this.point.x, this.point.y);
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
        this.line.remove();
    }
    public stepToPrevious() {
        this.canvas.add(this.line);
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
        highlightLine.acts.push(new ColorLineAction(canvas, line, "#000000", "#ff0000"));
        steps.push(highlightLine);

        // add all the steps for the body of the loop of this line
        steps = steps.concat(generateStepsForLine(canvas, rectData, line, lineData));
    });
    return steps;
}

function generateStepsForLine(canvas: SVG.Doc, rectData: Rect, line: SVG.Line, lineData: Line): VizStep[] {
    const steps: VizStep[] = [];

    // highlight a point and show its outcode
    const highlightFirstPoint = new VizStep(1);
    const firstPointOutcode = computeOutcode(rectData, lineData.p1);
    highlightFirstPoint.extraText = "The outcode for this point is " + outcodeToString(firstPointOutcode);
    highlightFirstPoint.acts.push(new HighlightPointAction(canvas, lineData.p1));
    steps.push(highlightFirstPoint);

    // highlight the other point and show its outcode
    const highlightSecondPoint = new VizStep(2);
    const secondPointOutcode = computeOutcode(rectData, lineData.p2);
    highlightSecondPoint.extraText = "The outcode for this point is " + outcodeToString(secondPointOutcode);
    highlightSecondPoint.acts.push(new HighlightPointAction(canvas, lineData.p2));
    steps.push(highlightSecondPoint);

    // check for trivial accept
    const trivialAcceptCheck = new VizStep(3);
    trivialAcceptCheck.extraText = `The outcodes come out to ${outcodeToString(firstPointOutcode)} and ${outcodeToString(secondPointOutcode)}.<br>` +
                                    `The result of the bitwise OR is ${outcodeToString(firstPointOutcode | secondPointOutcode)}`;
    steps.push(trivialAcceptCheck);

    if ((firstPointOutcode | secondPointOutcode) === 0) {
        // we are accepting trivially - highlight acceptance and continue on to next line.
        const trivialAcceptPassed = new VizStep(4);
        trivialAcceptPassed.acts.push(new ColorLineAction(canvas, line, "#ff0000", "#00aa00"));
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
