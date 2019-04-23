class AlgorithmExample {
    public readonly imagePath: string;
    public readonly inputPath: string;
    public readonly name: string | null;

    public constructor(imagePath: string, inputPath: string, name: string | null = null) {
        this.imagePath = imagePath;
        this.inputPath = inputPath;
        this.name = name;
    }
}
