import * as SVG from "svg.js";

export abstract class VizAction {
    protected canvas: SVG.Doc;
    constructor(canvas: SVG.Doc) {
        this.canvas = canvas;
    }

    public abstract stepFromPrevious(): void;
    public abstract stepToNext(): void;

    public abstract stepToPrevious(): void;
    public abstract stepFromNext(): void;
}
