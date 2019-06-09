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
    private lines!: svgjs.Line[];

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "queue = all endpoints", stepText: ""},
            {code: "tree = []", stepText: ""},
            {code: "output = []", stepText: ""},
            {code: "for e in queue:", stepText: ""},
            {code: "  U = lines with left point e", stepText: ""},
            {code: "  L = lines with right point e", stepText: "look in tree for adjacent"},
            {code: "  C = lines that contain e", stepText: "look in tree for adjacent"},
            {code: "  if union(U, L, C).count > 1:", stepText: ""},
            {code: "    output.add(e)", stepText: ""},
            {code: "  delete L and C from tree", stepText: ""},
            {code: "  insert U and C into tree", stepText: ""},
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
        // TODO
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

        const sweepline = new Sweepline("before");

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
            begin.segments.push([linePoint1(line).toArray(), linePoint2(line).toArray()]);

            queue.insert(end, end);
        });
        steps.push(queueInitStep);

        steps.push(new VizStep(1));
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
            this.handleEventPoint(point.key!, status, output, queue, sweepline);
        }

        steps.push(new VizStep(0, output.values().map(p => new AddElementAction(this.canvas, this.canvas.circle(5).cx(p.x).cy(p.y)))));

        return steps;
    }

    private handleEventPoint(point: SweepEvent, status: AVL<Segment, Segment>, output: AVL<SweepEvent, SweepEvent>, queue: AVL<SweepEvent, SweepEvent>, sweepline: Sweepline) {
        sweepline.setPosition("before");
        sweepline.setX(point.x);

        const Up = point.segments, // segments, for which this is the left end
            Lp: Segment[] = [],             // segments, for which this is the right end
            Cp: Segment[] = [];             // // segments, for which this is an inner point.

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

        if (Up.concat(Lp, Cp).length > 1) {
            output.insert(point, point);
        }

        for (const p of Cp) {
            status.remove(p);
        }

        sweepline.setPosition("after");

        for (const p of Up) {
            if (!status.contains(p)) {
                status.insert(p);
            }
        }
        for (const p of Cp) {
            if (!status.contains(p)) {
                status.insert(p);
            }
        }

        if (Up.length === 0 && Cp.length === 0) {
            for (const s of Lp) {
                const sNode = status.find(s),
                    sl = status.prev(sNode),
                    sr = status.next(sNode);

                if (sl && sr) {
                    findNewEvent(sl.key!, sr.key!, output, queue);
                }

                status.remove(s);
            }
        } else {
            const UCp = Up.concat(Cp).sort(utils.compareSegments),
                UCpmin = UCp[0],
                sllNode = status.find(UCpmin),
                UCpmax = UCp[UCp.length - 1],
                srrNode = status.find(UCpmax),
                sll = sllNode && status.prev(sllNode),
                srr = srrNode && status.next(srrNode);

            if (sll && UCpmin) {
                findNewEvent(sll.key!, UCpmin, output, queue);
            }

            if (srr && UCpmax) {
                findNewEvent(srr.key!, UCpmax, output, queue);
            }

            for (const p of Lp) {
                status.remove(p);
            }
        }
        return output;
    }
}

function findNewEvent(sl: Segment, sr: Segment, output: AVL<SweepEvent, SweepEvent>, queue: AVL<SweepEvent, SweepEvent>) {
    const intersectionCoords = utils.findSegmentsIntersection(sl, sr);
    let intersectionPoint: SweepEvent;

    if (intersectionCoords) {
        intersectionPoint = new SweepEvent(intersectionCoords, "intersection");

        if (!output.contains(intersectionPoint)) {
            queue.insert(intersectionPoint, intersectionPoint);
        }

        output.insert(intersectionPoint, intersectionPoint);
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

    constructor(position: string) {
        this.x = null;
        this.position = position;
    }

    public setPosition(position: string) {
        this.position = position;
    }

    public setX(x: number) {
        this.x = x;
    }
}
