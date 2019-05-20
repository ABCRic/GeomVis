import $ from "jquery";
import SVG from "svg.js";
import { VizualizationBase } from "../VizualizationBase";
import { PseudocodeLine } from "../PseudocodeLine";
import { VizStep } from "../VizStep";
import { angleRadians, pointsFromPolygon, rectEdgesClockwise, intersectionPoint, scaleLine, pointArrayToSVGPointArray, svgLineLength } from "../utils";
import { RIGHT_MOUSE_BUTTON, ENTER_KEY, LEFT_MOUSE_BUTTON } from "../constants";
import { AddElementAction, AddElementOnceAction, TransformElementAction } from "../Actions";
import { InputAction } from "../InputAction";
import { pushToUndoHistory } from "../geomvis";
import { Rect, Point, Line } from "../geometrytypes";
import { SymmetricalVizAction } from "../SymmetricalVizAction";
import { EntryOnlyVizAction } from "../EntryOnlyVizAction";

export class LineSegmentIntersectionViz extends VizualizationBase {
    private lines!: svgjs.Line[];

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "queue = all endpoints", stepText: ""},
            {code: "tree = []", stepText: ""},
            {code: "output = []", stepText: ""},
            {code: "for e in queue:", stepText: ""},
            {code: "if e is left endpoint:", stepText: ""},
            {code: "    seg_e = segment of e", stepText: ""},
            {code: "    seg_a = segment above seg_e", stepText: ""},
            {code: "    seg_b = segment below seg_b", stepText: ""},
            {code: "    tree.insert(seg_e)", stepText: ""},
            {code: "    if i = intersect(seg_a, seg_b):", stepText: ""},
            {code: "    queue.delete(i)", stepText: ""},
            {code: "    if i = intersect(seg_e, seg_a):", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
            {code: "    if i = intersect(seg_e, seg_b):", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
            {code: "    ", stepText: ""},
            {code: "elseif e is right endpoint:", stepText: ""},
            {code: "    seg_e = segment of e", stepText: ""},
            {code: "    seg_a = segment above seg_e", stepText: ""},
            {code: "    seg_b = segment below seg_b", stepText: ""},
            {code: "    tree.remove(seg_e)", stepText: ""},
            {code: "    if i = intersect(seg_a, seg_b):", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
            {code: "    ", stepText: ""},
            {code: "elseif e is intersection point:", stepText: ""},
            {code: "    output.add(e)", stepText: ""},
            {code: "    seg_e1 = segment coming from above", stepText: ""},
            {code: "    seg_e2 = segment coming from below", stepText: ""},
            {code: "    tree.swap(seg_e1, seg_e2)", stepText: ""},
            {code: "    seg_a = segment above seg_e2", stepText: ""},
            {code: "    seg_b = segment below seg_e1", stepText: ""},
            {code: "    if i = intersect(seg_e1, seg_a):", stepText: ""},
            {code: "    queue.delete(i)", stepText: ""},
            {code: "    if i = intersect(seg_e2, seg_b):", stepText: ""},
            {code: "    queue.delete(i)", stepText: ""},
            {code: "    if i = intersect(seg_e2, seg_a):", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
            {code: "    if i = intersect(seg_e1, seg_b):", stepText: ""},
            {code: "    queue.add(i)", stepText: ""},
        ];
    }

    public getHintText(): string {
        return "Click and drag to draw lines; Click lines to remove them";
    }

    public setupCanvas(canvas: svgjs.Doc): void { return; }

    public setupInput(canvas: svgjs.Doc): void {
        this.setUndoRedoAllowed(true);

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

        return steps;
    }
}