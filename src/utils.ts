import * as SVG from "svg.js";
import { Point } from "./geometrytypes";

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
