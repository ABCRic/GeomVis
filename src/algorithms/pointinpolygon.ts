import $ from "jquery";
import SVG from "svg.js";
import { VizualizationBase } from "../VizualizationBase";
import { PseudocodeLine } from "../PseudocodeLine";
import { VizStep } from "../VizStep";
import { EntryOnlyVizAction } from "../EntryOnlyVizAction";
import { getSVGCoordinatesForMouseEvent, angleRadians, pointsFromPolygon } from "../utils";
import { RIGHT_MOUSE_BUTTON, ENTER_KEY, LEFT_MOUSE_BUTTON } from "../constants";
import { Point } from "../geometrytypes";
import { AddElementAction, TransformElementAction } from "../Actions";

const EPSILON = 0.0001; // error margin for floating-point sum of angles in winding number algorithm

export class PointInPolygonViz extends VizualizationBase {
    private point: svgjs.Circle | null = null;
    private polygon: svgjs.Polygon | null = null;

    public getPseudocode(): PseudocodeLine[] {
        return [
            {code: "angle_sum = 0", stepText: "We'll sum the angles of the turns we take by going over the length of the polygon from the point of view of the given point, which we'll call P0. We start at 0 radians."},
            {code: "for each edge (P1, P2):", stepText: "We take each edge of the polygon in order, either clockwise or counterclockwise."},
            {code: "  angle_sum += angle(P1, P2, p)", stepText: "Measure the angle between the points, from the point of view of P0. Add it to the sum."},
            {code: "winding_num = angle_sum / 2*pi", stepText: "The winding number is how many turns we took in total. A turn is equal to 2π radians, so by dividing the sum by 2π we get the number of turns."},
            {code: "return winding_num !≈ 0", stepText: "Finally we check if the winding number is approximately zero, which means the point is outside, or otherwise, which means the point is inside. The approximate check is required due to possible floating-point approximation errors while calculating the angles."},
        ];
    }

    public getHintText(): string {
        return "Click to start drawing a polygon.";
    }

    public setupCanvas(canvas: svgjs.Doc): void { return; }

    public setupInput(canvas: svgjs.Doc): void {
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
            this.setHintText("Now click to add the point.");

            // add handler for drawing the point
            canvas.on("mousedown", (e: MouseEvent) => {
                // ignore if we already have a point
                if (this.point !== null) return;
                // ignore non-left clicks
                if (e.button !== LEFT_MOUSE_BUTTON) return;

                // create the circle for the point
                const loc = getSVGCoordinatesForMouseEvent(canvas, e);
                this.point = canvas.circle(8).center(loc.x, loc.y);

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

        const pivotLocation = new Point(this.point!.cx(), this.point!.cy());
        const polygonPoints = pointsFromPolygon(this.polygon!);
        const circles: svgjs.Circle[] = [];

        const showWindingNum = new VizStep(0);
        const addAngleTextAct = new AddTextAction(this.canvas, {x: this.point!.cx(), y: this.point!.cy() + 30}, "0");
        const angleText = addAngleTextAct.getElement();
        showWindingNum.acts.push(addAngleTextAct);
        for (const point of polygonPoints) {
            const act = new AddCircleAction(this.canvas, point);
            circles.push(act.getElement());
            showWindingNum.acts.push(act);
        }
        steps.push(showWindingNum);

        const loopStart = new VizStep(1);
        steps.push(loopStart);

        let angleSum = 0;
        for (let i = 0; i < polygonPoints.length; i++) {
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[(i + 1) % polygonPoints.length]; // wrap around for the last line

            // highlight points
            const loopCondition = new VizStep(1);
            const point1Color = new ColorPointAction(this.canvas, circles[i], "black", "orange");
            const point2Color = new ColorPointAction(this.canvas, circles[(i + 1) % polygonPoints.length], "black", "orange");
            const line1 = new AddElementAction(this.canvas, this.canvas.line(pivotLocation.x, pivotLocation.y, p1.x, p1.y).stroke("black"));
            const line2 = new AddElementAction(this.canvas, this.canvas.line(pivotLocation.x, pivotLocation.y, p2.x, p2.y).stroke("black"));
            const movingLine = new AddElementAction(this.canvas, this.canvas.line(pivotLocation.x, pivotLocation.y, p1.x, p1.y).stroke("black"));
            loopCondition.acts.push(point1Color, point2Color, line1, line2, movingLine);
            steps.push(loopCondition);

            // turn character and sum, unhighlight points.
            const loopBody = new VizStep(2);
            const oldAngleSum = angleSum;
            const angle = angleRadians(p1, pivotLocation, p2);
            angleSum += angle;
            loopBody.acts.push(new UpdateTextAction(this.canvas, angleText, (oldAngleSum / Math.PI).toFixed(2) + "π", (angleSum / Math.PI).toFixed(2) + "π"));
            loopBody.acts.push(new TransformElementAction(this.canvas, movingLine.getElement(),
                l => l.animate(250).plot(pivotLocation.x, pivotLocation.y, p2.x, p2.y),
                l => l.animate(250).plot(pivotLocation.x, pivotLocation.y, p1.x, p1.y)));
            loopBody.extraText = `The angle between the two points is ${(angle / Math.PI).toFixed(2)}π radians.`;
            steps.push(loopBody);

            const loopBodyCleanup = new VizStep(2);
            loopBodyCleanup.acts.push(point1Color.getReverse(), point2Color.getReverse(), line1.getReverse(), line2.getReverse(), movingLine.getReverse());
            steps.push(loopBodyCleanup);
        }

        const windingNumberCalc = new VizStep(3);
        const windingNumber = angleSum / (2 * Math.PI);
        // TODO show winding number
        steps.push(windingNumberCalc);

        const returnState = new VizStep(4);
        if (Math.abs(windingNumber) < EPSILON) {
            returnState.extraText = "The winding number is 0, therefore the points is outside.";
            returnState.acts.push(new ColorPointAction(this.canvas, this.point!, "black", "red"));
        } else {
            returnState.extraText = `The winding number is ${windingNumber.toFixed(0)}, therefore the point is inside.`;
            returnState.acts.push(new ColorPointAction(this.canvas, this.point!, "black", "green"));
        }
        steps.push(returnState);

        return steps;
    }
}

class UpdateTextAction extends EntryOnlyVizAction {
    private text: svgjs.Text;
    private previousText: string;
    private newText: string;

    constructor(canvas: svgjs.Doc, text: svgjs.Text, previousText: string, newText: string) {
        super(canvas);
        this.text = text;
        this.previousText = previousText;
        this.newText = newText;
    }

    public stepFromPrevious(): void {
        this.text.text(this.newText);
    }

    public stepToPrevious(): void {
        this.text.text(this.previousText);
    }
}

class AddCircleAction extends AddElementAction<svgjs.Circle> {
    constructor(canvas: svgjs.Doc, location: Point) {
        super(
            canvas,
            canvas.circle(10).center(location.x, location.y));
    }
}

class AddTextAction extends AddElementAction<svgjs.Text> {
    constructor(canvas: svgjs.Doc, location: Point, str: string) {
        super(
            canvas,
            canvas
                .text(str)
                .center(location.x, location.y)
                .attr("text-anchor", "middle")
                .font({family: "Helvetica, sans-serif"}));
    }
}

class ColorPointAction extends EntryOnlyVizAction {
    private point: SVG.Circle;
    private fromColor: string;
    private toColor: string;

    constructor(canvas: SVG.Doc, circle: SVG.Circle, fromColor: string, toColor: string) {
        super(canvas);
        this.point = circle;
        this.fromColor = fromColor;
        this.toColor = toColor;
    }

    public stepFromPrevious(): void {
        this.point.animate(250).fill(this.toColor);
    }
    public stepToPrevious(): void {
        this.point.fill(this.fromColor);
    }
}
