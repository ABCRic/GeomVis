import $ from "jquery";
import SVG from "svg.js";
import { VizualizationBase } from "../VizualizationBase";
import { PseudocodeLine } from "../PseudocodeLine";
import { VizStep } from "../VizStep";
import { angleRadians, pointsFromPolygon, rectEdgesClockwise, intersectionPoint, scaleLine } from "../utils";
import { RIGHT_MOUSE_BUTTON, ENTER_KEY } from "../constants";
import { AddElementAction, AddElementOnceAction } from "../Actions";
import { InputAction } from "../InputAction";
import { pushToUndoHistory } from "../geomvis";
import { Rect, Point, Line } from "../geometrytypes";
import { SymmetricalVizAction } from "../SymmetricalVizAction";

export class SutherlandHodgmanViz extends VizualizationBase {
    private rect!: SVG.Rect;
    private polygon!: SVG.Polygon;
    private leftGuideline!: SVG.Line;
    private rightGuideline!: SVG.Line;
    private topGuideline!: SVG.Line;
    private bottomGuideline!: SVG.Line;

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "outlist = input", stepText: "<b>This algorithm uses the output of the previous step as the input to the next step.</b> The input for the initial step is the input polygon itself."},
            {code: "for each clipEdge in clipPolygon:", stepText: "We iterate over each edge of the clipping polygon - in this case, a simple rectangle - but the procedure is the same for all convex clipping polygons."},
            {code: "  inlist = outlist", stepText: "This algorithm uses the output of the previous step as the input to the next step. So we copy the output from the previous step to the input..."},
            {code: "  outlist.clear()", stepText: "...and clear the output so we can use it during the current step."},
            {code: "  for each P_start, P_end in inlist:", stepText: "We start iterating through the edges in the input. Each edge runs from P_start to P_end."},
            {code: "    if P_end is inside:", stepText: "Is the end point on the inside relative to the clip edge?"},
            {code: "      if P_start is outside:", stepText: "The end point is inside. Is the start point outside?"},
            {code: "        outlist.add(intersection(P_start,P_end,clipEdge))", stepText: "The end point is inside, but the start point is outside. Therefore we clip the edge at the intersection with the clipping edge and the resulting edge runs from the intersection to P_end. So we insert the intersection point in the output."},
            {code: "      outlist.add(P_end)", stepText: "Whether the start point is inside or not, as the point is inside we insert it in the output."},
            {code: "    else if P_start is inside:", stepText: "Is the start point on the inside relative to the clip edge?"},
            {code: "      outlist.add(intersection(P_start,P_end,clipEdge))", stepText: "The start point is inside, but the end point is not. So we clip the edge at the intersection with the clipping edge. The resulting edge runs from the start to the intersection point. Note that the start point was already added in a previous step."},
        ];
    }

    public getHintText(): string {
        return "Click to start drawing a polygon, or\n" +
               "hold Shift and click and drag the rectangle to move it";
    }

    public setupCanvas(canvas: svgjs.Doc): void {
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

    public setupInput(canvas: svgjs.Doc): void {
        this.setUndoRedoAllowed(true);

        // alias for inner class scopes
        const updateGuidelinesFunc = () => this.updateGuidelines();

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

        // setup polygon drawing

        // on click, start drawing
        canvas.on("mousedown", () => {
            // only start drawing if we don't have a polygon already
            if (this.polygon != null) return;

            this.polygon = canvas.polygon([]).draw().attr("stroke-width", 1).attr("fill", "none");
            const poly = this.polygon!; // alias for inner scopes

            // input listeners for finishing polygon drawing
            const enterEventListener = function(e: KeyboardEvent) {
                if (e.keyCode === ENTER_KEY) {
                    poly.draw("done");
                    poly.off("drawstart");
                }
            };
            const rightClickEventListener = function(e: MouseEvent) {
                if (e.button === RIGHT_MOUSE_BUTTON) {
                    poly.draw("done");
                    poly.off("drawstart");
                }
            };

            // handler to start drawing (on click)
            this.polygon!.on("drawstart", () => {
                document.addEventListener("keydown", enterEventListener);
                document.addEventListener("mousedown", rightClickEventListener);
                canvas.node.addEventListener("contextmenu", e => e.preventDefault());
                this.setHintText("Left-click to draw the lines of the polygon. Right-click or press enter to finish polygon.");
            });

            // handler for when drawing is finished
            this.polygon!.on("drawstop", () => {
                document.removeEventListener("keydown", enterEventListener);
                document.removeEventListener("mousedown", rightClickEventListener);
                this.setHintText("Click 'Compute' to start.");
            });
        });
    }

    public loadFromString(contents: string): void {
        // TODO
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

    public computeSteps(): VizStep[] {
        const steps: VizStep[] = [];

        const inside = (clipEdge: Line, point: Point) =>
            angleRadians(clipEdge.p2, clipEdge.p1, point) >= 0; // angle between clip edge and point must be clockwise

        const input = pointsFromPolygon(this.polygon);
        const outlist: Point[] = input.slice();
        steps.push(new VizStep(0));

        const rectData = Rect.fromSvgRect(this.rect);

        steps.push(new VizStep(1));
        let c = 0;
        for (const clipLine of rectEdgesClockwise(rectData)) {
            const clipAxis = scaleLine(clipLine, 100000); // we scale the clip line to be like an axis for intersection point calculation

            const inlist = outlist.slice();
            const outputTransferStep = new VizStep(2);
            outputTransferStep.acts.push(new AddElementAction(this.canvas,
                this.canvas.polygon(inlist.map(p => [p.x, p.y])).stroke(["green", "yellow", "red", "blue"][c]).fill({opacity: 0})));
            steps.push(outputTransferStep);
            outlist.length = 0;
            steps.push(new VizStep(3));
c++;
            // iterate over edges of input polygon
            for (let i = 0; i < inlist.length; i++) {
                // get endpoints of current edge
                const P_end = inlist[i];
                const P_start = i - 1 < 0 ? inlist[inlist.length - 1] : inlist[i - 1];
                const highlightLine = new VizStep(4);
                // highlight that line
                highlightLine.acts.push(new AddElementOnceAction(this.canvas, this.canvas.line(P_start.x, P_start.y, P_end.x, P_end.y).stroke("orange")));
                steps.push(highlightLine);

                const highlightPEnd = new VizStep(5);
                highlightPEnd.acts.push(new HighlightPointAction(this.canvas, P_end));
                steps.push(highlightPEnd);
                if (inside(clipLine, P_end)) {
                    const highlightPStart = new VizStep(6);
                    highlightPStart.acts.push(new HighlightPointAction(this.canvas, P_start));
                    steps.push(highlightPStart);
                    if (!inside(clipLine, P_start)) {
                        const intersect = intersectionPoint(new Line(P_start, P_end), clipAxis)!;
                        const step = new VizStep(7);
                        step.acts.push(new AddElementOnceAction(this.canvas, this.canvas.circle(10).center(intersect.x, intersect.y)));
                        steps.push(step);
                        outlist.push(intersect);
                    }
                    outlist.push(P_end);
                } else {
                    const highlightPStart = new VizStep(9);
                    highlightPStart.acts.push(new HighlightPointAction(this.canvas, P_start));
                    steps.push(highlightPStart);
                    if (inside(clipLine, P_start)) {
                        const intersect = intersectionPoint(new Line(P_start, P_end), clipAxis)!;
                        const step = new VizStep(10);
                        step.acts.push(new AddElementOnceAction(this.canvas, this.canvas.circle(10).center(intersect.x, intersect.y)));
                        steps.push(step);
                        outlist.push(intersect);
                    }
                }
            }
        }

        const showFinalOutputStep = new VizStep(2);
        showFinalOutputStep.acts.push(new AddElementAction(this.canvas,
            this.canvas.polygon(outlist.map(p => [p.x, p.y])).stroke("magenta").fill({color: "magenta", opacity: 1})));
        steps.push(showFinalOutputStep);

        return steps;
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
