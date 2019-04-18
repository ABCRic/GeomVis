import * as $ from "jquery";
import * as SVG from "svg.js";
import { VizualizationBase } from "./VizualizationBase";
import { PseudocodeLine } from "./PseudocodeLine";
import { VizStep } from "./VizStep";
import { LEFT_MOUSE_BUTTON } from "./constants";
import { pushToUndoHistory } from "./geomvis";
import { InputAction } from "./InputAction";
import { getSVGCoordinatesForMouseEvent } from "./utils";
import { EntryOnlyVizAction } from "./EntryOnlyVizAction";
import { Point } from "./geometrytypes";

const CIRCLE_SIZE = 10;

function circleToPoint(c: svgjs.Circle): Point {
    return {x: c.cx(), y: c.cy()};
}

function clockwise(p1: Point, p2: Point, p3: Point) {
    // get the z-value for of the cross product of p1->p2 and p1->p3
    // positive: left turn, zero: colinear, negative: right turn
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) < 0;
}

export class ConvexHullViz extends VizualizationBase {
    private points: svgjs.Circle[] = [];

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "stack = empty_stack()", stepText: "We create an empty stack to hold the points. We'll use the stack during computation, and at the end of the algorithm the stack will contain the points of the hull."},
            {code: "find the lowest point -> P0", stepText: "To start with, we find the lowest point, that is, the one with the lowest Y value (Y axis pointing up). If there are multiple with the same Y value, we pick the leftmost one. We'll call this point P0."},
            {code: "sort the points by angle with P0", stepText: "Then we find the angle from P0 to each of the other points and sort them by that angle."},
            {code: "add P0 and next point to stack", stepText: "We add P0 and the next point to the stack to bootstrap the algorithm."},
            {code: "for each point:", stepText: "We go through each point of the sorted list, in order. For each one we take the next steps."},
            {code: "  while stack.count() > 1 and\n      clockwise(stack.belowTop(),\n                stack.top(),\n                point):", stepText: "While the stack has at least two points, we want to check if the current point and the two before form a clockwise turn (a \"right turn\")."},
            {code: "    stack.pop()", stepText: "We found a \"right turn\" - a clockwise turn. This means that if we keep the last point, the hull turns inside and back out, which means it is not convex. So we remove that point from the stack."},
            {code: "  stack.push(point)", stepText: "When we're done eliminating clockwise turns, we add the current point to the stack. Then we go on to the next point."},
            {code: "done", stepText: "The algorithm is finished and the stack contains the points forming the convex hull in counterclockwise order."},
        ];
    }

    public getHintText(): string {
        return "Click to add points. Click points to remove them.";
    }

    public setupCanvas(canvas: svgjs.Doc): void { return; }

    public setupInput(canvas: svgjs.Doc): void {
        canvas.on("mousedown", (event: MouseEvent) => {
            if (!this.editingAllowed) return;

            if (event.button !== LEFT_MOUSE_BUTTON) return;

            // add point
            const loc = getSVGCoordinatesForMouseEvent(canvas, event);
            const point = canvas.circle(CIRCLE_SIZE).center(loc.x, loc.y);
            this.points.push(point);

            const points = this.points; // alias for inner class
            // add to history
            pushToUndoHistory(new class extends InputAction {
                private el: svgjs.Circle;
                constructor(el: svgjs.Circle) {
                    super();
                    this.el = el;
                }
                public undo() {
                    this.el.remove();
                    points.splice(points.indexOf(this.el), 1);
                }
                public redo() {
                    canvas.add(this.el);
                    points.push(this.el);
                }
            }(point));

            // make point be removed on click
            const deleteUndoEvent = new class extends InputAction {
                private el: svgjs.Circle;
                constructor(el: svgjs.Circle) {
                    super();
                    this.el = el;
                }
                public undo() {
                    canvas.add(this.el);
                    points.push(this.el);
                }
                public redo() {
                    this.el.remove();
                    points.splice(points.indexOf(this.el), 1);
                }
            }(point);

            point.on("mousedown", function(this: svgjs.Line, event: MouseEvent) {
                deleteUndoEvent.redo();
                pushToUndoHistory(deleteUndoEvent);
                event.stopPropagation();
            });

            return false;
        });
    }

    public loadFromString(contents: string): void {
        const doc = new DOMParser().parseFromString(contents, "image/svg+xml");
        const docCircles = doc.getElementsByTagName("circle");

        // clear current points
        this.points.forEach(point => point.remove());
        this.points.length = 0;

        for (const circle of docCircles) {
            const adoptedCircle = SVG.adopt(circle) as svgjs.Circle;
            const newPoint = this.canvas.circle(CIRCLE_SIZE).center(adoptedCircle.x(), adoptedCircle.y());
            this.canvas.add(newPoint);
            this.points.push(newPoint);
        }
    }

    public onEnableEditing() {
        document.getElementById("topcontainer")!.style.display = "block";
        $("#topcontainer").animate({
            top: "10px"
        }, 500, "swing");
    }

    public onDisableEditing() {
        $("#topcontainer").animate({
            top: "-200px"
        }, 500, "swing", function() {
            document.getElementById("topcontainer")!.style.display = "none";
        });
    }

    public computeSteps(): VizStep[] {
        const steps: VizStep[] = [];
        steps.push(new VizStep(0));

        // select p0
        let p0 = this.points[0];
        for (const point of this.points) {
            // the algorithm specifies the point with the lowest Y value should be used
            // but our Y axis points down so we do it the other way around.
            if (point.y() > p0.y()) { // point is lower
                p0 = point;
            } else if (point.y() === p0.y() && point.x() < p0.x()) { // point is at the same y but more to the left
                p0 = point;
            }
        }
        const selectP0 = new VizStep(1);
        selectP0.acts.push(new NumberPointAction(this.canvas, p0, 0));
        steps.push(selectP0);

        // order points by angle
        const pointsCopy = this.points.splice(0);
        pointsCopy.splice(pointsCopy.indexOf(p0), 1); // remove p0
        const sortedPoints = pointsCopy.sort(
            (a, b) => {
                const cotanA = -(a.cx() - p0.cx()) / (a.cy() - p0.cy());
                const cotanB = -(b.cx() - p0.cx()) / (b.cy() - p0.cy());
                return cotanA - cotanB < 0 ? 1 : -1;
            });
        for (const [i, point] of sortedPoints.entries()) {
            const highlightPoint = new VizStep(2);
            highlightPoint.acts.push(new NumberPointAction(this.canvas, point, i + 1));
            highlightPoint.acts.push(new ProjectBeamAction(this.canvas, p0, point));
            steps.push(highlightPoint);
        }

        const edges = new Map<svgjs.Circle, svgjs.Line>(); // runtime edges
        const haveEdges: svgjs.Circle[] = []; // generation-time edges
        const stack = [
            //sortedPoints[sortedPoints.length - 1],
            p0,
            sortedPoints[0]
        ];
        const addPoints = new VizStep(3);
        //addPoints.acts.push(new ColorPointAction(this.canvas, sortedPoints[sortedPoints.length - 1], "white", "orange", "black", "white"));
        addPoints.acts.push(new ColorPointAction(this.canvas, p0, "white", "orange", "black", "white"));
        addPoints.acts.push(new ColorPointAction(this.canvas, sortedPoints[0], "white", "orange", "black", "white"));
        steps.push(addPoints);
        // main loop
        for (const point of sortedPoints.slice(1)) {
            // highlight point under iteration
            const highlightPoint = new VizStep(4);
            highlightPoint.acts.push(new ColorPointAction(this.canvas, point, "white", "orange", "black", "white"));
            steps.push(highlightPoint);

            while (stack.length > 1) {
                // hightlight points being checked
                const checkCCW = new VizStep(5);
                if (haveEdges.indexOf(stack[stack.length - 1]) === -1) {
                    checkCCW.acts.push(new ColorPointAction(this.canvas, stack[stack.length - 2], "white", "orange", "black", "white"));
                    checkCCW.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 2], stack[stack.length - 1]));
                    haveEdges.push(stack[stack.length - 1]);
                }
                if (haveEdges.indexOf(point) === -1) {
                    checkCCW.acts.push(new ColorPointAction(this.canvas, stack[stack.length - 1], "white", "orange", "black", "white"));
                    checkCCW.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 1], point));
                    haveEdges.push(point);
                }
                steps.push(checkCCW);

                if (!clockwise(
                    circleToPoint(stack[stack.length - 2]),
                    circleToPoint(stack[stack.length - 1]),
                    circleToPoint(point))) {
                    // erase corner
                    const eraseLine = new VizStep(6);
                    eraseLine.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 2], stack[stack.length - 1]).getReverse());
                    haveEdges.splice(haveEdges.indexOf(stack[stack.length - 1]));
                    eraseLine.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 1], point).getReverse());
                    haveEdges.splice(haveEdges.indexOf(point));
                    eraseLine.acts.push(new ColorPointAction(this.canvas, stack[stack.length - 1], "orange", "white", "white", "black"));
                    steps.push(eraseLine);
                    stack.pop();
                } else {
                    break;
                }
            }
            if (stack.length > 0) {
                const addLine = new VizStep(7);
                addLine.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 1], point));
                haveEdges.push(point);
                steps.push(addLine);
            }

            stack.push(point);
        }

        const addLastLine = new VizStep(8);
        addLastLine.acts.push(new AddLineAction(this.canvas, edges, stack[stack.length - 1], p0));
        steps.push(addLastLine);

        return steps;
    }
}

class ProjectBeamAction extends EntryOnlyVizAction {
    private from: svgjs.Circle;
    private to: svgjs.Circle;

    constructor(canvas: svgjs.Doc, from: svgjs.Circle, to: svgjs.Circle) {
        super(canvas);
        this.from = from;
        this.to = to;
    }

    public stepFromPrevious(): void {
        this.canvas.line([
            [this.from.cx(),
             this.from.cy()],
            [this.from.cx() + 0.1 * (this.to.cx() - this.from.cx()),
             this.from.cy() + 0.1 * (this.to.cy() - this.from.cy())]
        ])
        .stroke({width: 3, color: "black"})
        .animate(250).plot([
            [this.from.cx() + 0.9 * (this.to.cx() - this.from.cx()),
             this.from.cy() + 0.9 * (this.to.cy() - this.from.cy())],
            [this.to.cx(),
             this.to.cy()]])
            .after(function(this: svgjs.Animation) {
                this.remove();
            });
    }
    public stepToPrevious(): void { return; }
}

class AddLineAction extends EntryOnlyVizAction {
    private edges: Map<svgjs.Circle, svgjs.Line>;
    private from: svgjs.Circle;
    private to: svgjs.Circle;

    constructor(canvas: svgjs.Doc, edges: Map<svgjs.Circle, svgjs.Line>,
                from: svgjs.Circle, to: svgjs.Circle) {
        super(canvas);
        this.edges = edges;
        this.from = from;
        this.to = to;
    }

    public stepFromPrevious(): void {
        if (this.edges.get(this.to)) return;
        const line = this.canvas.line([
            [this.from.cx(),
             this.from.cy()],
            [this.from.cx() + 0.1 * (this.to.cx() - this.from.cx()),
             this.from.cy() + 0.1 * (this.to.cy() - this.from.cy())]
        ])
        .stroke({width: 3, color: "black"});
        line.animate(250).plot([
            [this.from.cx(),
             this.from.cy()],
            [this.to.cx(),
             this.to.cy()]]);
        this.edges.set(this.to, line);
    }

    public stepToPrevious(): void {
        if (this.edges.get(this.to)) {
            this.edges.get(this.to)!.remove();
            this.edges.delete(this.to);
        }
    }
}

class NumberPointAction extends EntryOnlyVizAction {
    private point: svgjs.Circle;
    private index: number;
    private text: svgjs.Text | null = null;

    constructor(canvas: svgjs.Doc, point: svgjs.Circle, index: number) {
        super(canvas);
        this.point = point;
        this.index = index;
    }

    public stepFromPrevious(): void {
        this.point.animate(400)
            .stroke({width: 3, color: "orange"})
            .fill({color: "white"})
            .radius(12);

        this.text = this.canvas.text(this.index.toString())
                        .center(this.point.cx(), this.point.cy())
                        .font({family: "Helvetica, sans-serif"});
        this.point.data("text", this.text.id(), true);
    }

    public stepToPrevious(): void {
        this.point.animate(400)
            .fill({opacity: 1, color: "black"})
            .stroke({width: 0, color: "black"})
            .radius(CIRCLE_SIZE);
        this.text!.remove();
        this.point.data("text", null);
    }
}

class ColorPointAction extends EntryOnlyVizAction {
    private point: SVG.Circle;
    private fromColor: string;
    private toColor: string;
    private textFromColor: string;
    private textToColor: string;

    constructor(canvas: SVG.Doc, line: SVG.Circle, fromColor: string, toColor: string, textFromColor: string, textToColor: string) {
        super(canvas);
        this.point = line;
        this.fromColor = fromColor;
        this.toColor = toColor;
        this.textFromColor = textFromColor;
        this.textToColor = textToColor;
    }

    public stepFromPrevious(): void {
        this.point.animate(250).fill(this.toColor);
        (SVG.get(this.point.data("text")) as svgjs.Text).fill(this.textToColor);
    }
    public stepToPrevious(): void {
        this.point.fill(this.fromColor);
        (SVG.get(this.point.data("text")) as svgjs.Text).fill(this.textFromColor);
    }
}
