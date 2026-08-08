declare module "flubber" {
  export type FlubberInterpolator = (t: number) => string;

  export function interpolate(
    fromShape: string,
    toShape: string,
    options?: {
      maxSegmentLength?: number;
      string?: boolean;
    },
  ): FlubberInterpolator;
}
