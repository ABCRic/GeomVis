import { Line, Point, Rect } from "./geometrytypes";

export const pseudoCode =
[{code: "for each line", stepText: "We take the following sequence of steps for each line we have to process."},
 {code: "  outcode1 = outcode(endpoint1)", stepText: "First, we check where one of the ends of the line is, and give it an outcode. Which end we choose first doesn't matter."},
 {code: "  outcode2 = outcode(endpoint2)", stepText: "Then we do the same for the other end of the line."},
 {code: "  if outcode1 | outcode2 == 0", stepText: "We check the outcodes: by using | (bitwise OR) we can quickly check if any of them have any bits set. Because the region of the clipping rectangle is all zeroes, if the result of the bitwise OR is zero then we know both ends of the line are inside the rectangle. Then we can trivially accept it."},
 {code: "    goto next line", stepText: "Since the whole line is inside the rectangle, we don't know to do anything and can start processing the next line."},
 {code: "  if outcode1 & outcode2", stepText: "We check the outcodes again: by using & (bitwise AND) we can compare every bit of the outcode, each corresponding to one outside zone. If both ends of the line are in the same zone, they will have a common bit set, which means the line is outside the rectangle. Then we can trivially reject it."},
 {code: "    delete line", stepText: "Since we detected the line was outside the rectangle, we remove it entirely."},
 {code: "    goto next line", stepText: "Then we start processing the next line."},
 {code: "  pick a point that's outside", stepText: "Since the line was neither fully inside nor fully outside, we need to clip an outside portion. Select an end point of the line that's outside. If both are outside, we can choose either one. We can check if an end point is outside by checking if its outcode is different than zero."},
 {code: "  replace it with the rectangle intersection point", stepText: "Use the straight line equation, Y = slope * X + base, to find the point of the line where it intersects the sides of the rectangle. We do this for both the X and Y axes. Then we replace the point we chose with this new point."},
 {code: "  back to start of loop", stepText: "We've clipped a portion of the line, so now we have a new line. We go back to the start of the loop and process this new line."}];

const OUTCODE_INSIDE = 0;
const OUTCODE_LEFT = 1;
const OUTCODE_RIGHT = 2;
const OUTCODE_BOTTOM = 4;
const OUTCODE_TOP = 8;

function computeOutcode(rect: Rect, point: Point): number {
    let outcode = OUTCODE_INSIDE;

    if (point.x < rect.left)
        outcode = outcode || OUTCODE_LEFT;
    if (point.x > rect.right)
        outcode = outcode || OUTCODE_RIGHT;
    if (point.y < rect.top)
        outcode = outcode || OUTCODE_TOP;
    if (point.y > rect.bottom)
        outcode = outcode || OUTCODE_BOTTOM;

    return outcode;
}

function clipLine(rect: Rect, line: Line): (Line | null) {
    let outcode1 = computeOutcode(rect, line.p1);
    let outcode2 = computeOutcode(rect, line.p2);

    while (true) {
        if (outcode1 === 0 && outcode2 === 0) {
            // both endpoints inside
            return line;
        } else if ((outcode1 & outcode2) !== 0) {
            // endpoints share a specific outside region
            return null;
        } else {
            // at least one of the points is outside so we pick one that is
            let outsideOutcode: number;
            let choseOutcode1: boolean;
            if (outcode1 !== 0) {
                outsideOutcode = outcode1;
                choseOutcode1 = true;
            } else {
                outsideOutcode = outcode2;
                choseOutcode1 = false;
            }

            const newPoint = new Point(0, 0);

            // y = base + slope * x
            // slope = (y2 - y1) / (x2 - x1)
            // x = x1 + (1 / slope) * (yborder - y1) for top and bottom
            // y = y1 + slope * (xborder - x1) for left and right
            const slope = (line.p2.y - line.p1.y) / (line.p2.x - line.p1.x);
            if ((outsideOutcode & OUTCODE_TOP) !== 0) {
                newPoint.x = line.p1.x + (1 / slope) * (rect.top - line.p1.x);
                newPoint.y = rect.top;
            } else if ((outsideOutcode & OUTCODE_BOTTOM) !== 0) {
                newPoint.x = line.p1.x + (1 / slope) * (rect.bottom - line.p1.x);
                newPoint.y = rect.bottom;
            } else if ((outsideOutcode & OUTCODE_LEFT) !== 0) {
                newPoint.x = rect.left;
                newPoint.y = line.p1.y + slope * (rect.left - line.p1.x);
            } else if ((outsideOutcode & OUTCODE_RIGHT) !== 0) {
                newPoint.x = rect.right;
                newPoint.y = line.p1.y + slope * (rect.right - line.p1.x);
            }

            if (choseOutcode1) {
                line.p1 = newPoint;
                outcode1 = computeOutcode(rect, line.p1);
            } else {
                line.p2 = newPoint;
                outcode2 = computeOutcode(rect, line.p2);
            }
        }
    }
}

// explanation steps
// for each line
//   check where endpoint 1 is and associate outcode
//   check where endpoint 2 is and associate outcode
//   if trivial accept
//     next line
//   if trivial reject
//     delete line
//     next line
//   pick a point that's outside
//   clip it to the wall
//   back to start of loop
function cohenSutherland(rect: Rect, lines: Line[]) {
    lines.forEach(line => {
        clipLine(rect, line);
    });
}
