import { PseudocodeLine } from "./PseudocodeLine";
import { VizStep } from "./VizStep";
import { setHintText, setUndoRedoAllowed } from "./geomvis";

export abstract class VizualizationBase {
    protected canvas: svgjs.Doc;
    protected editingAllowed: boolean = true;
    constructor(canvas: svgjs.Doc) {
        this.canvas = canvas;
    }

    public abstract getPseudocode(): PseudocodeLine[];
    public abstract getHintText(): string;
    public abstract setupCanvas(canvas: svgjs.Doc): void;
    public abstract setupInput(canvas: svgjs.Doc): void;
    public abstract loadFromString(contents: string): void;
    public abstract onEnableEditing(): void;
    public abstract onDisableEditing(): void;
    public abstract computeSteps(): VizStep[];

    public setAllowEditing(allowEditing: boolean): void {
        if (allowEditing && !this.editingAllowed) {
            this.editingAllowed = true;
            this.onEnableEditing();
        } else if (!allowEditing && this.editingAllowed) {
            this.editingAllowed = false;
            this.onDisableEditing();
        }
    }

    ////////////////
    // UI utils
    ////////////////
    protected setHintText(text: string) {
        setHintText(text);
    }

    protected setUndoRedoAllowed(allowed: boolean) {
        setUndoRedoAllowed(allowed);
    }
}
