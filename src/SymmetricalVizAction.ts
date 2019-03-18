import { VizAction } from "./VizAction";

/**
 * A visualization action that does the same thing both ways - when stepping forwards and when stepping back.
 * Boilerplate reduction for actions that really only matter during their step such as coloring a line just for highlighting it.
 */
export abstract class SymmetricalVizAction extends VizAction {
    public abstract enter(): void;
    public abstract exit(): void;
    public stepFromPrevious(): void {
        this.enter();
    }
    public stepFromNext(): void {
        this.enter();
    }
    public stepToNext(): void {
        this.exit();
    }
    public stepToPrevious(): void {
        this.exit();
    }
}
