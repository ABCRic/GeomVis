import { VizAction } from "./VizAction";

/**
 * A visualization action that only does something only when entering from or stepping back to the previous step.
 * Boilerplate reduction for actions that only have an action when transitioning from the previous one.
 */
export abstract class EntryOnlyVizAction extends VizAction {
    public stepFromNext(): void { return; }
    public stepToNext(): void { return; }

    /**
     * Returns an action whose transitions are the reverse of this action:
     * stepFromPrevious does what stepToPrevious does, and vice-versa.
     */
    public getReverse(): EntryOnlyVizAction {
        return new class extends EntryOnlyVizAction {
            private action: EntryOnlyVizAction;
            constructor(action: EntryOnlyVizAction) {
                super(action.getCanvas());
                this.action = action;
            }
            public stepFromPrevious(): void {
                this.action.stepToPrevious();
            }
            public stepToPrevious(): void {
                this.action.stepFromPrevious();
            }
        }(this);
    }
}
