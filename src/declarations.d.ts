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

    // this method works perfectly but it's not in the provided types for some reason
    interface Animation {
        stroke(color: string): this;
        stroke(data: StrokeData): this;
    }
}