import $ from "jquery";
import SVG from "svg.js";
import { VizualizationBase } from "../VizualizationBase";
import { PseudocodeLine } from "../PseudocodeLine";
import { VizStep } from "../VizStep";
import { EntryOnlyVizAction } from "../EntryOnlyVizAction";
import { getSVGCoordinatesForMouseEvent, angleRadians } from "../utils";
import { RIGHT_MOUSE_BUTTON, ENTER_KEY, LEFT_MOUSE_BUTTON } from "../constants";
import { Point } from "../geometrytypes";
import { AddElementAction, TransformElementAction } from "../Actions";
import { InputAction } from "../InputAction";
import { pushToUndoHistory } from "../geomvis";

export class SutherlandHodgmanViz extends VizualizationBase {
    private rect!: SVG.Rect;
    private polygon!: SVG.Polygon;
    private leftGuideline!: SVG.Line;
    private rightGuideline!: SVG.Line;
    private topGuideline!: SVG.Line;
    private bottomGuideline!: SVG.Line;

    public getPseudocode(): PseudocodeLine[] {
        return [
            
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
