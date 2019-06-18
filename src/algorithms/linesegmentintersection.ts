import $ from "jquery";
import SVG from "svg.js";
import { VizualizationBase } from "../VizualizationBase";
import { PseudocodeLine } from "../PseudocodeLine";
import { VizStep } from "../VizStep";
import { svgLineLength, linePoint1, linePoint2 } from "../utils";
import { LEFT_MOUSE_BUTTON } from "../constants";
import { AddElementAction, TransformElementAction } from "../Actions";
import { InputAction } from "../InputAction";
import { pushToUndoHistory } from "../geomvis";
import AVL from "avl";
import utils, { Segment } from "./linesegmentintersection.utils";

export class LineSegmentIntersectionViz extends VizualizationBase {
    segs: Map<Segment, svgjs.Line> = new Map();
    private lines!: svgjs.Line[];

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "queue = all endpoints", stepText: "We use a <b>priority queue</b> to store point \"events\". These events are either endpoints of lines or possible intersection points. The priority queue is ordered by the X coordinate of the point in the event.<br>"
                                                    + "We initialize the queue with the endpoints of the input lines."},
            {code: "tree = new binarytree()", stepText: "We initialize a balanced binary search tree to store the <b>status</b> of the algorithm. The status is the list of segments intersecting the sweepline, ordered by the y coordinate of the intersection point."},
            {code: "output = []", stepText: "We initialize an empty list to store the result - the intersection points. We'll add the found intersection points to this list."},
            {code: "for e in queue:", stepText: "We take the first event in the queue, until the queue is empty."},
            {code: "  U = lines with left point e <div style='height: 100%; background-color: green'></div>", stepText: "Let U be the set of lines whose left point is e."},
            {code: "  L = lines in tree with right point e", stepText: "Search in the status tree for all lines whose right point is e."},
            {code: "  C = lines in tree that contain e", stepText: "Search in the status tree for all lines that contain e."},
            {code: "  if union(U, L, C).count > 1:", stepText: "Check how many lines we found. If the union of all these sets contains more than one line, we have an intersection."},
            {code: "    output.add(e)", stepText: "Add the intersection to the result."},
            {code: "  delete union(L, C) from tree", stepText: "Remove the lines that end at e from the tree (L), as they no longer cross the sweepline.<br>We also remove the lines that contain the point (C), as if they cross they are no longer in the same order. We will reinsert those in the next step."},
            {code: "  insert union(U, C) into tree", stepText: "Readd the lines that contain the point (C) into the tree so they are reordered. Add any lines that start at this point, as they are now crossing the sweepline."},
            {code: "  if union(U, C).empty:", stepText: ""},
            {code: "    s_L = left neighbor of e in tree", stepText: ""},
            {code: "    s_R = right neighbor of e in tree", stepText: ""},
            {code: "    FindNewEvent(s_L, s_R, e)", stepText: ""},
            {code: "  else:", stepText: ""},
            {code: "    s' = leftmost neighbor of union(U, C) in tree", stepText: ""},
            {code: "    s_L = left neighbor of s' in tree", stepText: ""},
            {code: "    FindNewEvent(s_L, s', e)", stepText: ""},
            {code: "    s'' = rightmost neighbor of union(U, C) in tree", stepText: ""},
            {code: "    s_R = right neighbor of s'' in tree", stepText: ""},
            {code: "    FindNewEvent(s'', s_R, e)", stepText: ""},
            {code: "", stepText: ""},
            {code: "FindNewEvent(s_L, s_R, p):", stepText: ""},
            {code: "  i = intersect(s_L, s_R):", stepText: ""},
            {code: "  if i.x > p.x:", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
            {code: "  output.add(i)", stepText: ""},
        ];
    }

    public getHintText(): string {
        return "Click and drag to draw lines; Click lines to remove them";
    }

    public setupCanvas(canvas: svgjs.Doc): void { return; }

    public setupInput(canvas: svgjs.Doc): void {
        this.setUndoRedoAllowed(true);
        this.lines = [];

        // aliases for inner class scopes
        const lines = this.lines;

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

                    ghost.on("mousedown", function(this: SVG.Line) {
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

    public loadFromString(contents: string): void {
        const doc = new DOMParser().parseFromString(contents, "image/svg+xml");
        const docLines = doc.getElementsByTagName("line");
        const docPaths = doc.getElementsByTagName("path");

        // clear current lines
        this.lines.forEach(line => {
            line.remove();
        });
        this.lines.length = 0;

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

        const addSweepLineAct = new AddElementAction(this.canvas, this.canvas.line(-50, -50000, -50, 50000).stroke({color: "red", width: 2}));
        const sweepline = new Sweepline("before", addSweepLineAct.getElement());

        // init
        const queueInitStep = new VizStep(0);
        const queue = new AVL<SweepEvent, SweepEvent>(utils.comparePoints, true);
        // add all endpoints to queue
        this.lines.forEach(line => {
            const points = [linePoint1(line).toArray(), linePoint2(line).toArray()].sort(utils.comparePoints);

            const addBeginPoint = new AddElementAction(this.canvas, this.canvas.circle(5).cx(points[0][0]).cy(points[0][1]).fill("black"));
            queueInitStep.acts.push(addBeginPoint);
            let begin = new SweepEvent(points[0], "begin", addBeginPoint.getElement());
            const addEndPoint = new AddElementAction(this.canvas, this.canvas.circle(5).cx(points[1][0]).cy(points[1][1]).fill("black"));
            queueInitStep.acts.push(addEndPoint);
            const end = new SweepEvent(points[1], "end", addEndPoint.getElement());

            queue.insert(begin, begin);
            begin = queue.find(begin).key!;
            const seg: Segment = [linePoint1(line).toArray(), linePoint2(line).toArray()];
            this.segs.set(seg, line);
            begin.segments.push(seg);

            queue.insert(end, end);
        });
        steps.push(queueInitStep);

        steps.push(new VizStep(1, [addSweepLineAct]));
        const status = new AVL<Segment, Segment>(utils.compareSegments.bind(sweepline), true);
        steps.push(new VizStep(2));
        const output = new AVL<SweepEvent, SweepEvent>(utils.comparePoints, true);

        // main loop
        while (!queue.isEmpty()) {
            const point = queue.pop();
            // highlight point
            steps.push(new VizStep(3, [new TransformElementAction(this.canvas, point.key!.element,
                el => el.fill("orange"),
                el => el.fill("black"))]));
            steps.push(...this.handleEventPoint(point.key!, status, output, queue, sweepline));
        }

        steps.push(new VizStep(0, output.values().map(p => new AddElementAction(this.canvas, this.canvas.circle(5).cx(p.x).cy(p.y)))));

        return steps;
    }

    private handleEventPoint(point: SweepEvent, status: AVL<Segment, Segment>, output: AVL<SweepEvent, SweepEvent>, queue: AVL<SweepEvent, SweepEvent>, sweepline: Sweepline) {
        const steps: VizStep[] = [];

        sweepline.setPosition("before");
        sweepline.setX(point.x);
        let oldPos: svgjs.PointArrayAlias;
        steps.push(new VizStep(3, [new TransformElementAction(this.canvas, sweepline.element, el => {
            oldPos = el.array();
            el.animate(500, "<>").plot(point.x, linePoint1(el).y, point.x, linePoint2(el).y);
        },
        el => el.plot(oldPos))]));

        const Up = point.segments, // segments, for which this is the left end
            Lp: Segment[] = [],             // segments, for which this is the right end
            Cp: Segment[] = [];             // // segments, for which this is an inner point.

        const highlightU = new VizStep(4, Up.map(seg => new TransformElementAction(this.canvas, this.segs.get(seg)!,
            l => l.stroke("lime"),
            l => l.stroke("black"))));
        steps.push(highlightU);

        // step 2
        status.forEach(function(node) {
            const segment = node.key!,
                segmentBegin = segment[0],
                segmentEnd = segment[1];

            // count right-ends
            if (Math.abs(point.x - segmentEnd[0]) < utils.EPS && Math.abs(point.y - segmentEnd[1]) < utils.EPS) {
                Lp.push(segment);
            // count inner points
            } else {
                // filter left ends
                if (!(Math.abs(point.x - segmentBegin[0]) < utils.EPS && Math.abs(point.y - segmentBegin[1]) < utils.EPS)) {
                    if (Math.abs(utils.direction(segmentBegin, segmentEnd, [point.x, point.y])) < utils.EPS && utils.onSegment(segmentBegin, segmentEnd, [point.x, point.y])) {
                        Cp.push(segment);
                    }
                }
            }
        });

        const highlightL = new VizStep(5, Lp.map(seg => new TransformElementAction(this.canvas, this.segs.get(seg)!,
            l => l.stroke("yellow"),
            l => l.stroke("black"))));
        steps.push(highlightL);

        const highlightC = new VizStep(6, Cp.map(seg => new TransformElementAction(this.canvas, this.segs.get(seg)!,
            l => l.stroke("red"),
            l => l.stroke("black"))));
        steps.push(highlightC);

        steps.push(new VizStep(7)); // show branch
        if (Up.concat(Lp, Cp).length > 1) {
            steps.push(new VizStep(8, [new AddElementAction(this.canvas, this.canvas.circle(10).cx(point.x).cy(point.y).fill("red"))])); // highlight collision point
            output.insert(point, point);
        }

        const deleteLines = new VizStep(9);
        for (const p of Cp) {
            let prevDashArray: any;
            deleteLines.acts.push(new TransformElementAction(this.canvas, this.segs.get(p)!,
                l => {
                    prevDashArray = l.attr("stroke-dasharray");
                    l.attr("stroke-dasharray", "");
                },
                l => l.attr("stroke-dasharray", prevDashArray)));

            status.remove(p);
        }
        steps.push(deleteLines);

        sweepline.setPosition("after");

        const addLines = new VizStep(10);
        for (const p of Up) {
            if (!status.contains(p)) {
                let prevDashArray: any;
                addLines.acts.push(new TransformElementAction(this.canvas, this.segs.get(p)!,
                    l => {
                        prevDashArray = l.attr("stroke-dasharray");
                        l.attr("stroke-dasharray", "4");
                    },
                    l => l.attr("stroke-dasharray", prevDashArray)));

                status.insert(p);
            }
        }
        for (const p of Cp) {
            if (!status.contains(p)) {
                let prevDashArray: any;
                addLines.acts.push(new TransformElementAction(this.canvas, this.segs.get(p)!,
                    l => {
                        prevDashArray = l.attr("stroke-dasharray");
                        l.attr("stroke-dasharray", "4");
                    },
                    l => l.attr("stroke-dasharray", prevDashArray)));

                status.insert(p);
            }
        }
        steps.push(addLines);

        steps.push(new VizStep(11));
        if (Up.length === 0 && Cp.length === 0) {
            for (const s of Lp) {
                const sNode = status.find(s),
                    sl = status.prev(sNode),
                    sr = status.next(sNode);

                if (sl && sr) {
                    this.findNewEvent(sl.key!, sr.key!, output, queue);
                }

                status.remove(s);
            }
        } else {
            steps.push(new VizStep(15));
            const UCp = Up.concat(Cp).sort(utils.compareSegments),
                UCpmin = UCp[0],
                sllNode = status.find(UCpmin),
                UCpmax = UCp[UCp.length - 1],
                srrNode = status.find(UCpmax),
                sll = sllNode && status.prev(sllNode),
                srr = srrNode && status.next(srrNode);

            if (sll && UCpmin) {
                this.findNewEvent(sll.key!, UCpmin, output, queue);
            }

            if (srr && UCpmax) {
                this.findNewEvent(srr.key!, UCpmax, output, queue);
            }

            for (const p of Lp) {
                status.remove(p);
            }
        }

        return steps;
    }

    private findNewEvent(sl: Segment, sr: Segment, output: AVL<SweepEvent, SweepEvent>, queue: AVL<SweepEvent, SweepEvent>) {
        const intersectionCoords = utils.findSegmentsIntersection(sl, sr);
        let intersectionPoint: SweepEvent;

        if (intersectionCoords) {
            intersectionPoint = new SweepEvent(intersectionCoords, "intersection", this.canvas.circle(5).cx(intersectionCoords[0]).cy(intersectionCoords[1]).fill("black"));

            if (!output.contains(intersectionPoint)) {
                queue.insert(intersectionPoint, intersectionPoint);
            }

            output.insert(intersectionPoint, intersectionPoint);
        }
    }
}

class SweepEvent {
    public x: number;
    public y: number;
    public type: "begin" | "end" | "intersection";
    public segments: Segment[] = [];
    public element: svgjs.Circle;

    constructor(coords: [number, number], type: "begin" | "end" | "intersection", element: svgjs.Circle) {
        this.x = coords[0];
        this.y = coords[1];
        this.type = type;
        this.element = element;
    }
}

class Sweepline {
    public x: number | null;
    public position: string;
    public element: svgjs.Line;

    constructor(position: string, element: svgjs.Line) {
        this.x = null;
        this.position = position;
        this.element = element;
    }

    public setPosition(position: string) {
        this.position = position;
    }

    public setX(x: number) {
        this.x = x;
    }
}
