export abstract class InputAction {
    public abstract undo(): void;
    public abstract redo(): void;
}
