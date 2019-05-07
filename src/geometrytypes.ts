export class Point {
    public x: number;
    public y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

export class Line {
    public p1: Point;
    public p2: Point;
    constructor(p1: Point, p2: Point) {
        this.p1 = p1;
        this.p2 = p2;
    }
}

export class Rect {
    public static fromSvgRect(svgRect: svgjs.Rect) {
        return new Rect(new Point(svgRect.x(), svgRect.y()), new Point(svgRect.x() + svgRect.width(), svgRect.y() + svgRect.height()));
    }

    public topLeft: Point;
    public bottomRight: Point;
    constructor(topLeft: Point, bottomRight: Point) {
        this.topLeft = topLeft;
        this.bottomRight = bottomRight;
    }
    get left(): number {
        return this.topLeft.x;
    }
    get top(): number {
        return this.topLeft.y;
    }
    get right(): number {
        return this.bottomRight.x;
    }
    get bottom(): number {
        return this.bottomRight.y;
    }
}
