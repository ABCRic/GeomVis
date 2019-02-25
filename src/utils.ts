import * as SVG from "svg.js";

export function svgLineLength(line: SVG.Line) : number {
    let points = line.array().toLine();
    return Math.sqrt(
        (points.x2 - points.x1) ** 2 +
        (points.y2 - points.y1) ** 2
    );
}