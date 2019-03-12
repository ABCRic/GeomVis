import { VizAction } from "./VizAction";
export class VizStep {
    public acts: VizAction[] = [];
    public codeLine: number;
    public extraText: string | null = null;

    constructor(codeLine: number) {
        this.codeLine = codeLine;
    }

    public stepFromPrevious(): void {
        this.acts.forEach(a => a.stepFromPrevious());
    }
    public stepToNext(): void {
        this.acts.forEach(a => a.stepToNext());
    }

    public stepToPrevious(): void {
        this.acts.forEach(a => a.stepToPrevious());
    }
    public stepFromNext(): void {
        this.acts.forEach(a => a.stepFromNext());
    }
}
