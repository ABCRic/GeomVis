type Point = [number, number];
type PointArrayOrStruct = Point | {x: number, y: number};
type Segment = [Point, Point];

export const EPS: number;
export const onSegment: (a: Point, b: Point, c: Point) => boolean;
export const direction: (a: Point, b: Point, c: Point) => number;
export const segmentsIntersect: (a: Segment, b: Segment) => boolean;
export const findSegmentsIntersection: (a: Segment, b: Segment) => Point | false;
export const compareSegments: (a: Segment, b: Segment) => number;
export const comparePoints: (a: PointArrayOrStruct, b: PointArrayOrStruct) => number;