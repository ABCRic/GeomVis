// extend JQuery to add modals from bootstrap
interface JQuery {
    modal(args?: any): JQuery;
}

declare namespace svgjs {
    // add overload for adopt that takes actual SVG elements
    interface Library {
        adopt(node: SVGElement): Element;
    }

    // add types for svg.js plugins
    interface Path {
        toPoly(): PolyLine;
    }
    interface Rect {
        selectize(deepSelect: boolean): this;
        selectize(options: any): this;
        resize(): this;
        draggable(): this;
    }
    interface Line {
        draw(any: any, any2?: any): any;
    }

    // add methods we're using safely on animation
    interface Animation {
        stroke(color: string): this;
        stroke(data: StrokeData): this;
        
        fill(fill: { color?: string; opacity?: number, rule?: string }): this;
        fill(color: string): this;
        fill(pattern: Element): this;
        fill(image: Image): this;

        radius(x: number, y?: number): this;

        plot(points: PointArrayAlias): this;
        plot(x1: number, y1: number, x2: number, y2: number): this;

        remove(): this;
    }
}