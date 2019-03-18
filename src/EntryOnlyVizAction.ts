import { VizAction } from "./VizAction";

/**
 * A visualization action that only does something only when entering from or stepping back to the previous step.
 * Boilerplate reduction for actions that only have an action when transitioning from the previous one.
 */
export abstract class EntryOnlyVizAction extends VizAction {
    public stepFromNext(): void { return; }
    public stepToNext(): void { return; }
}
