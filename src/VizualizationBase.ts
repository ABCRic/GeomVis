import { PseudocodeLine } from "./PseudocodeLine";
import { VizStep } from "./VizStep";

export abstract class VizualizationBase {
    protected canvas: svgjs.Doc;
    protected editingAllowed: boolean = true;
    constructor(canvas: svgjs.Doc) {
        this.canvas = canvas;
    }

    public abstract getPseudocode(): PseudocodeLine[];
    public abstract setupCanvas(canvas: svgjs.Doc): void;
    public abstract setupInput(canvas: svgjs.Doc): void;
    public abstract loadFromString(contents: string): void;
    public abstract onEnableEditing(): void;
    public abstract onDisableEditing(): void;
    public abstract computeSteps(): VizStep[];

    public setAllowEditing(allowEditing: boolean): void {
        if (allowEditing && !this.editingAllowed) {
            this.onEnableEditing();
        } else if (!allowEditing && this.editingAllowed) {
            this.onDisableEditing();
        }
    }
}
