import { EntryOnlyVizAction } from "./EntryOnlyVizAction";

/**
 * Represents an action that adds a given element.
 * The element is immediately added to the canvas and hidden from view. This simplifies lifetime management.
 * The element can be obtained using getElement().
 * Stepping from the previous step shows the element, stepping back to previous step hides the element.
 * To remove an element, use the getReverse() method on an instance of this action.
 */
export class AddElementAction<T extends svgjs.Element> extends EntryOnlyVizAction {
    constructor(canvas: svgjs.Doc, private element: T) {
        super(canvas);
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

/**
 * Represents an action that applies a transformation on a given element.
 * Callbacks are passed in to transform the element. This simplifies the boilerplate needed for an action that transforms an element.
 * Stepping from the previous step, and back, calls the appropriate callbacks.
 */
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
