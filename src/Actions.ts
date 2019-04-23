import { EntryOnlyVizAction } from "./EntryOnlyVizAction";

export class AddElementAction<T extends svgjs.Element> extends EntryOnlyVizAction {
    constructor(canvas: svgjs.Doc, private element: T) {
        super(canvas);
        this.element = element;
        element.hide();
    }

    public stepFromPrevious(): void {
        this.element.show();
    }

    public stepToPrevious(): void {
        this.element.hide();
    }

    public getElement() { return this.element; }
}

export class TransformElementAction<T extends svgjs.Element> extends EntryOnlyVizAction {
    constructor(
        canvas: svgjs.Doc,
        private element: T,
        private fromPreviousCallback: (el: T) => void,
        private toPreviousCallback: (el: T) => void) {
        super(canvas);
    }

    public stepFromPrevious(): void {
        this.fromPreviousCallback(this.element);
    }

    public stepToPrevious(): void {
        this.toPreviousCallback(this.element);
    }

    public getElement() { return this.element; }
}
