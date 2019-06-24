import SVG from "svg.js";
import { Point, Rect, Line } from "./geometrytypes";
import { checkIntersection } from "line-intersect";

export function svgLineLength(line: SVG.Line): number {
    const points = line.array().toLine();
    return Math.sqrt(
        (points.x2 - points.x1) ** 2 +
        (points.y2 - points.y1) ** 2
    );
}

export function linePoint1(line: SVG.Line): Point {
    const points = line.array().toLine();
    return new Point(points.x1, points.y1);
}

export function linePoint2(line: SVG.Line): Point {
    const points = line.array().toLine();
    return new Point(points.x2, points.y2);
}

export function getSVGCoordinatesForMouseEvent(canvas: SVG.Doc, event: MouseEvent) {
    const pt = (canvas.node as any).createSVGPoint() as SVGPoint;
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform((canvas.node as any).getScreenCTM().inverse());
}

export function classOf<T extends object>(o: T): any {
    return o.constructor;
}

// computes angle of ABC in radians
// the angle returned is in the range ]-PI;PI], with positive values for clockwise angles
export function angleRadians(A: Point, C: Point, B: Point) {
    const a = {x: A.x - C.x, y: A.y - C.y}; // vector from A to C
    const b = {x: B.x - C.x, y: B.y - C.y}; // vector from B to C

    return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

export function pointsFromPolygon(polygon: svgjs.Polygon): Point[] {
    return (polygon.array().value as unknown as number[][]).map(p => new Point(p[0], p[1]));
}

export function rectEdgesClockwise(rect: Rect): Line[] {
    const topRight = new Point(rect.right, rect.top);
    const bottomLeft = new Point(rect.left, rect.bottom);
    return [
        new Line(bottomLeft, rect.topLeft),
        new Line(rect.topLeft, topRight),
        new Line(topRight, rect.bottomRight),
        new Line(rect.bottomRight, bottomLeft)
    ];
}

export function intersectionPoint(l1: Line, l2: Line): Point | null {
    const result = checkIntersection(
        l1.p1.x, l1.p1.y,
        l1.p2.x, l1.p2.y,
        l2.p1.x, l2.p1.y,
        l2.p2.x, l2.p2.y
    );
    if (result.type === "intersecting") {
        return new Point(result.point.x, result.point.y);
    }
    return null;
}

export function scaleLine(l: Line, factor: number): Line {
    const newP2 = new Point(
        l.p2.x + (l.p2.x - l.p1.x) * factor,
        l.p2.y + (l.p2.y - l.p1.y) * factor
    );
    const newP1 = new Point(
        l.p1.x - (l.p2.x - l.p1.x) * factor,
        l.p1.y - (l.p2.y - l.p1.y) * factor
    );
    return new Line(newP1, newP2);
}

export function pointArrayToSVGPointArray(points: Point[]): svgjs.PointArrayAlias {
    return points.map(p => [p.x, p.y]);
}
