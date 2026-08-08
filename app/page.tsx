"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import gradients from "./components/gradients";

const times = {
  origin: {
    location: "Seoul",
    coordinates: [37.5665, 126.978],
    takeoffTime: "2026-09-05T19:35:00Z",
    weather: "Clear",
  },
  current: {
    location: "unknown",
    coordinates: [13.3241, 2.3984],
    time: "2024-06-15T09-05:00Z",
    weather: "Clear",
  },
  destination: {
    location: "Toronto",
    coordinates: [43.65107, -79.347015],
    time: "2026-09-06T19:45:00Z",
    weather: "Clear",
  },
};

const timeZones = [
  "UTC+1",
  "UTC+2",
  "UTC+3",
  "UTC+4",
  "UTC+5",
  "UTC+6",
  "UTC+7",
  "UTC+8",
  "UTC+9",
  "UTC+10",
  "UTC+11",
  "UTC+12",
  "UTC-11",
  "UTC-10",
  "UTC-9",
  "UTC-8",
  "UTC-7",
  "UTC-6",
  "UTC-5",
  "UTC-4",
  "UTC-3",
  "UTC-2",
  "UTC-1",
  "UTC+0",
];

const offsetsRaw = [
  0, 0.01431, 0.03715, 0.061142, 0.076562, 0.093753, 0.117719, 0.144881,
  0.174599, 0.205915, 0.245539, 0.297306, 0.354049, 0.490883, 0.643181, 1,
];
const offsetsRoot = 0.7;
const offsets = offsetsRaw.map((o) => offsetsRoot + o * (1 - offsetsRoot));
const ELAPSED_PATH_VIEWBOX_WIDTH = 762;
const ELAPSED_PATH_VIEWBOX_HEIGHT = 190;
const INITIAL_FLIGHT_PROGRESS = 0.58;
const ORIGIN_TIMEZONE = "+9";

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")
  );
}

function getBestContrastBlackOrWhite(color: string): "#000000" | "#FFFFFF" {
  const [r, g, b] = hexToRgb(color);

  const srgbToLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const luminance =
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b);

  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#FFFFFF";
}

function interpolateColor(
  color1: string,
  color2: string,
  factor: number,
): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(
    r1 + (r2 - r1) * factor,
    g1 + (g2 - g1) * factor,
    b1 + (b2 - b1) * factor,
  );
}

function parseUtcOffsetHours(timezone: string | null): number {
  if (!timezone) return 0;
  const match = /^([+-]\d+)$/.exec(timezone);
  if (!match) return 0;
  const offset = Number.parseInt(match[1], 10);
  return Number.isFinite(offset) ? offset : 0;
}

function formatTimeTo12Hour(time24: string): string {
  const [hoursPart, minutesPart] = time24.split(":");
  const hours24 = Number.parseInt(hoursPart ?? "0", 10);
  const minutes = Number.parseInt(minutesPart ?? "0", 10);

  if (!Number.isFinite(hours24) || !Number.isFinite(minutes)) {
    return time24;
  }

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const formattedMinutes = String(minutes).padStart(2, "0");

  return `${hours12}:${formattedMinutes} ${period}`;
}

function calculateValues(
  flightProgress: number,
  timezone: string | null,
): {
  skyPhase: number;
  flightTime: string;
  localTime: string;
} {
  const clampedProgress = Math.min(1, Math.max(0, flightProgress));

  // Keep flight-time duration fixed at 13h10m independent of local clock span.
  const totalFlightTimeSeconds = 13 * 60 * 60 + 10 * 60;
  const elapsedFlightTime = totalFlightTimeSeconds * clampedProgress;

  const flightHours = Math.floor(elapsedFlightTime / 3600);
  const flightMinutes = Math.floor((elapsedFlightTime % 3600) / 60);

  const formattedFlightHours = String(flightHours).padStart(2, "0");
  const formattedFlightMinutes = String(flightMinutes).padStart(2, "0");
  const flightTimeString = `${formattedFlightHours}:${formattedFlightMinutes}`;

  // Drive clock progression from flight duration, then apply active timezone.
  const takeoffTimestamp = new Date(times.origin.takeoffTime).getTime();
  const elapsedFlightMilliseconds = Math.floor(elapsedFlightTime * 1000);
  const currentUtcTimestamp = takeoffTimestamp + elapsedFlightMilliseconds;
  const timezoneOffsetHours = parseUtcOffsetHours(timezone);
  const originTimezoneOffsetHours = parseUtcOffsetHours(ORIGIN_TIMEZONE);
  const timezoneDeltaHours = timezoneOffsetHours - originTimezoneOffsetHours;
  const currentLocalTimestamp =
    currentUtcTimestamp + timezoneDeltaHours * 60 * 60 * 1000;
  const currentFlightDate = new Date(currentLocalTimestamp);

  const hours = currentFlightDate.getUTCHours();
  const minutes = currentFlightDate.getUTCMinutes();

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const localTimeString = `${formattedHours}:${formattedMinutes}`;

  // Sky phase stays progress-driven. These breakpoints are tuned so
  // sunrise/sunset are short windows (~2h each) on a 24h10m flight arc.
  const maxPhase = gradients.length - 1;
  const nightPhase = 0;
  const dayPhase = maxPhase;
  const sunsetPhase = 11;

  const keyframes = [
    { progress: 0, phase: sunsetPhase },
    { progress: 0.072, phase: nightPhase },
    { progress: 0.3, phase: nightPhase },
    { progress: 0.562, phase: dayPhase },
    { progress: 0.917, phase: dayPhase },
    { progress: 1, phase: 30 },
  ];

  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const current = keyframes[i];
    const next = keyframes[i + 1];

    if (
      clampedProgress >= current.progress &&
      clampedProgress <= next.progress
    ) {
      const localProgress =
        (clampedProgress - current.progress) /
        (next.progress - current.progress);
      const phase =
        current.phase + (next.phase - current.phase) * localProgress;
      return {
        skyPhase: phase,
        flightTime: flightTimeString,
        localTime: localTimeString,
      };
    }
  }

  return {
    skyPhase: sunsetPhase,
    localTime: localTimeString,
    flightTime: flightTimeString,
  };
}

type PathDirectionAtProgress = {
  progress: number;
  length: number;
  point: { x: number; y: number };
  tangent: { x: number; y: number };
  angleRadians: number;
  angleDegrees: number;
  slope: number | null;
  timezone: string | null;
};

function getTimezoneFromZoneId(zoneId: string): string | null {
  const match = /^zone([+-]?\d+)$/.exec(zoneId);
  if (!match) return null;
  const offset = Number.parseInt(match[1], 10);
  if (!Number.isFinite(offset)) return null;
  return offset >= 0 ? `+${offset}` : `${offset}`;
}

function getPathDirectionAtProgress(
  path: SVGPathElement,
  progress: number,
  sampleDistance = 2,
  timezoneZoneSvg: SVGSVGElement | null = null,
): PathDirectionAtProgress {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const totalLength = path.getTotalLength();
  const targetLength = totalLength * clampedProgress;

  const beforeLength = Math.max(0, targetLength - sampleDistance);
  const afterLength = Math.min(totalLength, targetLength + sampleDistance);

  const beforePoint = path.getPointAtLength(beforeLength);
  const afterPoint = path.getPointAtLength(afterLength);
  const centerPoint = path.getPointAtLength(targetLength);

  const dx = afterPoint.x - beforePoint.x;
  const dy = afterPoint.y - beforePoint.y;
  const magnitude = Math.hypot(dx, dy) || 1;

  const ux = dx / magnitude;
  const uy = dy / magnitude;

  let timezone: string | null = null;
  if (timezoneZoneSvg && path.ownerSVGElement) {
    const routeSvgScreenCtm = path.ownerSVGElement.getScreenCTM();
    const zoneSvgScreenCtm = timezoneZoneSvg.getScreenCTM();

    if (routeSvgScreenCtm && zoneSvgScreenCtm) {
      const screenPoint = new DOMPoint(
        centerPoint.x,
        centerPoint.y,
      ).matrixTransform(routeSvgScreenCtm);
      const zonePoint = screenPoint.matrixTransform(zoneSvgScreenCtm.inverse());

      const zonePaths = Array.from(
        timezoneZoneSvg.querySelectorAll<SVGPathElement>('path[id^="zone"]'),
      );

      for (const zonePath of zonePaths) {
        if (zonePath.isPointInFill(zonePoint)) {
          timezone = getTimezoneFromZoneId(zonePath.id);
          break;
        }
      }
    }
  }

  return {
    progress: clampedProgress,
    length: targetLength,
    point: { x: centerPoint.x, y: centerPoint.y },
    tangent: { x: ux, y: uy },
    angleRadians: Math.atan2(uy, ux),
    angleDegrees: (Math.atan2(uy, ux) * 180) / Math.PI,
    slope: Math.abs(ux) < 1e-8 ? null : uy / ux,
    timezone,
  };
}

export default function Home() {
  const [flightProgress, setFlightProgress] = useState(INITIAL_FLIGHT_PROGRESS);
  const [isDragging, setIsDragging] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [pathDirectionVersion, setPathDirectionVersion] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineDragRef = useRef<HTMLDivElement>(null);
  const timelineDragVelocity = useRef<HTMLDivElement>(null);
  const edgesRef = useRef<HTMLDivElement>(null);
  const elapsedPathRef = useRef<SVGPathElement>(null);
  const remainingPathRef = useRef<SVGPathElement>(null);
  const timezoneZoneSvgRef = useRef<SVGSVGElement>(null);
  const pathDirection = useMemo<PathDirectionAtProgress | null>(() => {
    const useElapsedPath = flightProgress <= INITIAL_FLIGHT_PROGRESS;
    const activePath = useElapsedPath
      ? elapsedPathRef.current
      : remainingPathRef.current;
    if (!activePath) return null;

    const segmentProgress = useElapsedPath
      ? flightProgress / INITIAL_FLIGHT_PROGRESS
      : (flightProgress - INITIAL_FLIGHT_PROGRESS) /
        (1 - INITIAL_FLIGHT_PROGRESS);

    return getPathDirectionAtProgress(
      activePath,
      segmentProgress,
      2,
      timezoneZoneSvgRef.current,
    );
  }, [flightProgress, pathDirectionVersion]);

  const currentTimezone = pathDirection?.timezone ?? ORIGIN_TIMEZONE;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPathDirectionVersion((value) => value + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const { skyPhase, flightTime, localTime } = useMemo(
    () => calculateValues(flightProgress, currentTimezone),
    [flightProgress, currentTimezone],
  );
  const currentTimezoneLabel = useMemo(() => {
    const offset = Number.parseInt(currentTimezone ?? "+0", 10);
    if (!Number.isFinite(offset)) return "UTC+0";
    if (offset === 0) return "UTC+0";
    return offset > 0 ? `UTC+${offset}` : `UTC${offset}`;
  }, [currentTimezone]);
  const currentTimezoneIndex = useMemo(() => {
    const index = timeZones.indexOf(currentTimezoneLabel);
    return index >= 0 ? index : 0;
  }, [currentTimezoneLabel]);
  const localTimeDisplay = useMemo(
    () => formatTimeTo12Hour(localTime),
    [localTime],
  );
  const skyPhaseFraction = 1 - skyPhase / (gradients.length - 1);

  useEffect(() => {
    if (
      timelineRef.current &&
      timelineDragRef.current &&
      timelineDragVelocity.current &&
      edgesRef.current
    ) {
      const timeline = timelineRef.current;
      const dragElement = timelineDragRef.current;
      const velocityElement = timelineDragVelocity.current;
      let lastTouchX: number | null = null;

      const getProgressFromLeft = (left: number) => {
        const denominator = rectWidthRef();
        if (denominator <= 0 || !Number.isFinite(denominator)) return 0;
        return Math.min(1, Math.max(0, left / denominator));
      };

      const rectWidthRef = () =>
        timeline.getBoundingClientRect().width - dragElement.offsetWidth;

      const handleMouseMove = (event: MouseEvent) => {
        const rect = timeline.getBoundingClientRect();
        let newLeft = event.clientX - rect.left - dragElement.offsetWidth / 2;
        newLeft = Math.max(
          0,
          Math.min(newLeft, rect.width - dragElement.offsetWidth),
        );
        dragElement.style.left = `${newLeft}px`;

        //velo
        const velocity = event.movementX / rect.width;
        velocityElement.style.transform = `scaleX(${1 + velocity * 5})`;
        setFlightProgress(getProgressFromLeft(newLeft));
      };

      const handleTouchMove = (event: TouchEvent) => {
        const rect = timeline.getBoundingClientRect();
        const touchX = event.touches[0].clientX;
        let newLeft = touchX - rect.left - dragElement.offsetWidth / 2;
        newLeft = Math.max(
          0,
          Math.min(newLeft, rect.width - dragElement.offsetWidth),
        );
        dragElement.style.left = `${newLeft}px`;

        //velo
        const velocity = lastTouchX === null ? 0 : touchX - lastTouchX;
        velocityElement.style.transform = `scaleX(${1 + (velocity / rect.width) * 5})`;
        lastTouchX = touchX;
        setFlightProgress(getProgressFromLeft(newLeft));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        lastTouchX = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleMouseUp);
      };

      const handleMouseDown = () => {
        setIsDragging(true);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleMouseUp);
      };

      const handleTouchStart = () => {
        lastTouchX = null;
        handleMouseDown();
      };

      dragElement.addEventListener("mousedown", handleMouseDown);
      dragElement.addEventListener("touchstart", handleTouchStart);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleMouseUp);
        dragElement.removeEventListener("mousedown", handleMouseDown);
        dragElement.removeEventListener("touchstart", handleTouchStart);
      };
    }
  }, []);

  useEffect(() => {
    if (!mainRef.current) return;
    mainRef.current.style.setProperty(
      "--sky-phase",
      skyPhaseFraction.toString(),
    );
    mainRef.current.style.setProperty(
      "--white",
      `rgba(255, 255, 255, ${1 - skyPhaseFraction * 0.5})`,
    );
  }, [skyPhaseFraction]);

  useEffect(() => {
    if (!timelineRef.current || !timelineDragRef.current || isDragging) return;

    const timeline = timelineRef.current;
    const dragElement = timelineDragRef.current;

    const syncDragPosition = () => {
      const maxLeft = timeline.clientWidth - dragElement.offsetWidth;
      if (maxLeft <= 0) return;
      dragElement.style.left = `${maxLeft * flightProgress}px`;
    };

    syncDragPosition();
    window.addEventListener("resize", syncDragPosition);

    return () => {
      window.removeEventListener("resize", syncDragPosition);
    };
  }, [flightProgress, isDragging]);

  useEffect(() => {
    const direction = pathDirection;
    if (!direction) return;
    if (!mainRef.current) return;
    mainRef.current.style.setProperty(
      "--elapsed-x-norm",
      (direction.point.x / ELAPSED_PATH_VIEWBOX_WIDTH).toString(),
    );
    mainRef.current.style.setProperty(
      "--elapsed-y-norm",
      (direction.point.y / ELAPSED_PATH_VIEWBOX_HEIGHT).toString(),
    );
    mainRef.current.style.setProperty(
      "--elapsed-angle-deg",
      direction.angleDegrees.toString(),
    );
  }, [pathDirection]);

  const interpolatedColors = useMemo(() => {
    const totalGradients = gradients.length;
    const index = Math.min(totalGradients - 1, Math.max(0, skyPhase));
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.min(lowerIndex + 1, totalGradients - 1);
    const factor = index - lowerIndex;

    const lowerGradient = gradients[lowerIndex];
    const upperGradient = gradients[upperIndex];
    const interpolated = lowerGradient.map((color, i) =>
      interpolateColor(color, upperGradient[i], factor),
    );

    return interpolated;
  }, [skyPhase]);

  const easeInBack = (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  };

  const easeOut = (t: number): number => {
    return 1 - Math.pow(1 - t, 1.5);
  };

  const easeOutBack = (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  const clockTicksRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!clockTicksRef.current || !mainRef.current) return;

    const clockTicks = clockTicksRef.current.querySelectorAll("path");
    const clockRect = clockTicksRef.current.getBoundingClientRect();
    const localTimeHours = parseInt(localTime.split(":")[0], 10);
    const localTimeMinutes = parseInt(localTime.split(":")[1], 10);
    const localTimeHoursOnDial = localTimeHours % 12;
    const minutesPercent = localTimeMinutes / 60;
    const hoursPercent =
      (localTimeHoursOnDial * 60 + localTimeMinutes) / (12 * 60);

    mainRef.current.style.setProperty(
      "--minutes-percent",
      minutesPercent.toString(),
    );
    mainRef.current.style.setProperty(
      "--hours-percent",
      hoursPercent.toString(),
    );

    const clockColor = getBestContrastBlackOrWhite(interpolatedColors[14]);
    mainRef.current.style.setProperty("--clock-color", clockColor);
    clockTicks.forEach((tick, i) => {
      // factor clock color into here
      const top = tick.getBoundingClientRect().top;
      const parentTop = clockRect.top ?? 0;
      const topPercent = (top - parentTop) / clockRect.height;
      const index = 9 - Math.round(topPercent * (9 - 1)) - 1;
      const backdropRGB = "calc(var(--sky-phase, 0) * 150)";
      if (tick.dataset.type === "major") {
        tick.setAttribute(
          "stroke",
          `color-mix(in oklab, ${interpolatedColors[index]} calc(45% - var(--sky-phase, 0) * 10%), rgba(${backdropRGB},${backdropRGB},${backdropRGB},1))`,
        );
      } else if (tick.dataset.type === "minor") {
        tick.setAttribute(
          "stroke",
          `color-mix(in oklab, ${interpolatedColors[index]} calc(60% - var(--sky-phase, 0) * 10%), rgba(${backdropRGB},${backdropRGB},${backdropRGB},1))`,
        );
      }

      if (isDragging) {
        const tickCount = clockTicks.length;
        const centerTick = (1 - hoursPercent) * (tickCount - 1);
        const nearestTickCount = 10;
        const radiusInTicks = nearestTickCount / 2;
        const linearDistance = Math.abs(i - centerTick);
        const wrappedDistance = Math.min(
          linearDistance,
          tickCount - linearDistance,
        );
        const influence = Math.max(0, 1 - wrappedDistance / radiusInTicks);
        const easeFactor = easeOut(influence);
        const strokeWidth = 1 + 5 * easeFactor;
        tick.setAttribute("stroke-width", strokeWidth.toString());
      } else {
        tick.setAttribute("stroke-width", "1");
      }
    });
  }, [interpolatedColors, localTime, isDragging]);

  return (
    <main
      className="w-dvw h-dvh flex flex-col items-center justify-center overflow-hidden select-none"
      ref={mainRef}
    >
      <div className="relative w-[393px] h-[852px] bg-black">
        <Image
          className="absolute z-100 inset-[0_0_auto_0] pointer-events-none"
          src="/dynamic-island.png"
          alt="Logo"
          width={600}
          height={600}
        />
        <div className="absolute inset-0 flex flex-col">
          <div
            className="flex-1 relative flex items-center justify-center rounded-3xl z-0 pointer-events-none overflow-hidden"
            // style={{
            //   inset: `0 0 ${isMapVisible ? 300 : 128}px 0`,
            // }}
          >
            <svg
              style={{
                filter: `hue-rotate(calc(0deg - var(--sky-phase, 0) * 30deg)) saturate(calc(1 + var(--sky-phase, 0) * 1.5)) brightness(${1 - easeInBack(skyPhaseFraction) * 0.5})`,
              }}
              width="100%"
              height="100%"
              viewBox="0 0 393 852"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <defs>
                <radialGradient
                  id="animatedGradient"
                  cx="0%"
                  cy="196%"
                  r="300%"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform="translate(191.5 426) scale(1.75 1.5)"
                >
                  {interpolatedColors
                    .slice()
                    .reverse()
                    .map((color, i) => (
                      <stop key={i} offset={offsets[i]} stopColor={color} />
                    ))}
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#animatedGradient)" />
            </svg>
            <div className="absolute flex flex-col items-center gap-4 text-(--clock-color) transition-[color] duration-200">
              <div className="absolute z-1 inset-0 mask-[linear-gradient(to_bottom,transparent_5%,white_10%,white_90%,transparent_95%)]">
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 flex items-stretch justify-center gap-4">
                  <div className="flex items-stretch gap-0.5">
                    <div className="relative">
                      <h3 className="relative opacity-15">00:00</h3>
                      <h3 className="absolute inset-[0_0_0_auto]">
                        {localTimeDisplay.slice(0, 5)}
                      </h3>
                    </div>
                    <div className="flex flex-col items-center justify-between -translate-y-1">
                      <p
                        className="text-[10px]"
                        style={{
                          opacity:
                            localTimeDisplay.slice(-2) === "AM" ? 1 : 0.2,
                        }}
                      >
                        a
                      </p>
                      <p
                        className="text-[10px]"
                        style={{
                          opacity:
                            localTimeDisplay.slice(-2) === "PM" ? 1 : 0.2,
                        }}
                      >
                        p
                      </p>
                    </div>
                  </div>
                  <div className="relative w-23">
                    <div
                      className="absolute left-0 -top-1.5 w-full flex flex-col items-start gap-1 duration-200 ease-in-out"
                      style={{
                        transform: `translateY(calc(-${currentTimezoneIndex} * 100% / 24))`,
                      }}
                    >
                      {timeZones.map((label, index) => {
                        const directDistance = Math.abs(
                          index - currentTimezoneIndex,
                        );
                        const cyclicDistance = Math.min(
                          directDistance,
                          timeZones.length - directDistance,
                        );
                        const maxDistance =
                          Math.floor(timeZones.length / 2) - 3;
                        const delaySteps = isDragging
                          ? cyclicDistance
                          : maxDistance - cyclicDistance;
                        const threshold = isDragging ? 20 : 30;

                        return (
                          <div
                            className="w-full transition-opacity duration-200 ease-in-out"
                            style={{
                              opacity:
                                currentTimezoneLabel === label
                                  ? 1
                                  : isDragging
                                    ? 0.5
                                    : 0,
                              transitionDelay: `${delaySteps * threshold}ms`,
                            }}
                            key={label}
                          >
                            <div
                              className="w-full flex items-center justify-between pl-2 pr-2.5 py-1 rounded-lg transition-[background-color] duration-200 ease-in-out"
                              style={{
                                backgroundColor: isDragging
                                  ? "color-mix(in oklab,var(--clock-color) 5%,transparent)"
                                  : "transparent",
                              }}
                            >
                              <p className="text-[16px] duration-200">
                                {label}
                              </p>
                              <div
                                className="w-2 h-2 rounded-full bg-[#0073FF] duration-200"
                                style={{
                                  opacity: isDragging ? 1 : 0,
                                  transitionDelay: `${isDragging ? 0 : maxDistance * threshold}ms`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute z-1 inset-0">
                <svg
                  className="text-[#656D7F]"
                  id="clockTicks"
                  ref={clockTicksRef}
                  width="100%"
                  viewBox="0 0 360 360"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M171.044 9.05664L171.411 16.0566"
                    data-type="minor"
                  />
                  <path
                    d="M162.036 9.05664L162.772 16.0566"
                    data-type="minor"
                  />
                  <path
                    d="M152.923 9.05664L154.032 16.0566"
                    data-type="minor"
                  />
                  <path
                    d="M143.659 9.05664L145.147 16.0566"
                    data-type="minor"
                  />
                  <path
                    d="M134.188 9.06445L136.063 16.0616"
                    data-type="minor"
                  />
                  <path
                    d="M124.456 9.10156L126.724 16.0819"
                    data-type="minor"
                  />
                  <path
                    d="M114.431 9.21094L117.097 16.1574"
                    data-type="minor"
                  />
                  <path d="M104.054 9.45898L107.12 16.3458" data-type="minor" />
                  <path
                    d="M96.8178 16.7766L93.3569 9.98438"
                    data-type="minor"
                  />
                  <path
                    d="M82.4136 11.0215L89.4136 23.1458"
                    data-type="major"
                  />
                  <path d="M71.48 12.9258L75.6336 19.3218" data-type="minor" />
                  <path d="M60.939 16.1816L65.3657 22.2745" data-type="minor" />
                  <path d="M51.2358 21.0293L55.9259 26.821" data-type="minor" />
                  <path
                    d="M42.3062 27.1289L47.2559 32.6262"
                    data-type="minor"
                  />
                  <path
                    d="M34.4839 34.5527L39.4243 39.4932"
                    data-type="minor"
                  />
                  <path
                    d="M27.0679 42.3574L32.5651 47.3072"
                    data-type="minor"
                  />
                  <path d="M20.9683 51.2891L26.76 55.9791" data-type="minor" />
                  <path d="M16.1206 60.9902L22.2135 65.417" data-type="minor" />
                  <path
                    d="M12.8667 71.5312L19.2627 75.6849"
                    data-type="minor"
                  />
                  <path
                    d="M10.9624 82.4648L23.0868 89.4648"
                    data-type="major"
                  />
                  <path d="M16.7156 96.869L9.92334 93.4082" data-type="minor" />
                  <path d="M9.3999 104.105L16.2868 107.172" data-type="minor" />
                  <path d="M9.1499 114.482L16.0964 117.149" data-type="minor" />
                  <path
                    d="M9.04053 124.508L16.0208 126.776"
                    data-type="minor"
                  />
                  <path d="M9.00342 134.24L16.0006 136.115" data-type="minor" />
                  <path
                    d="M8.99561 143.711L15.9956 145.199"
                    data-type="minor"
                  />
                  <path
                    d="M8.99561 152.975L15.9956 154.083"
                    data-type="minor"
                  />
                  <path
                    d="M8.99561 162.088L15.9956 162.824"
                    data-type="minor"
                  />
                  <path
                    d="M8.99561 171.098L15.9956 171.465"
                    data-type="minor"
                  />
                  <path d="M9 180L22 180" data-type="major" />
                  <path d="M8.99561 189.01L15.9956 188.643" data-type="minor" />
                  <path
                    d="M8.99561 198.018L15.9956 197.282"
                    data-type="minor"
                  />
                  <path
                    d="M8.99561 207.131L15.9956 206.022"
                    data-type="minor"
                  />
                  <path
                    d="M8.99561 216.395L15.9956 214.907"
                    data-type="minor"
                  />
                  <path d="M9.00342 225.865L16.0006 223.99" data-type="minor" />
                  <path d="M9.04053 235.598L16.0208 233.33" data-type="minor" />
                  <path d="M9.1499 245.623L16.0964 242.957" data-type="minor" />
                  <path d="M9.39795 256L16.2848 252.934" data-type="minor" />
                  <path
                    d="M16.7156 263.236L9.92334 266.697"
                    data-type="minor"
                  />
                  <path
                    d="M10.9604 277.641L23.0848 270.641"
                    data-type="major"
                  />
                  <path
                    d="M12.8647 288.574L19.2608 284.421"
                    data-type="minor"
                  />
                  <path
                    d="M16.1206 299.115L22.2135 294.689"
                    data-type="minor"
                  />
                  <path d="M20.9683 308.818L26.76 304.128" data-type="minor" />
                  <path
                    d="M27.0679 317.748L32.5651 312.798"
                    data-type="minor"
                  />
                  <path
                    d="M34.4819 325.553L39.4224 320.612"
                    data-type="minor"
                  />
                  <path
                    d="M42.2964 332.986L47.2461 327.489"
                    data-type="minor"
                  />
                  <path d="M51.228 339.086L55.9181 333.294" data-type="minor" />
                  <path
                    d="M60.9312 343.934L65.3579 337.841"
                    data-type="minor"
                  />
                  <path
                    d="M71.4702 347.188L75.6238 340.791"
                    data-type="minor"
                  />
                  <path
                    d="M82.4058 349.092L89.4058 336.967"
                    data-type="major"
                  />
                  <path d="M96.808 343.339L93.3472 350.131" data-type="minor" />
                  <path d="M104.044 350.654L107.11 343.767" data-type="minor" />
                  <path
                    d="M114.421 350.904L117.087 343.958"
                    data-type="minor"
                  />
                  <path
                    d="M124.446 351.014L126.714 344.033"
                    data-type="minor"
                  />
                  <path
                    d="M134.179 351.051L136.054 344.054"
                    data-type="minor"
                  />
                  <path
                    d="M143.649 351.059L145.137 344.059"
                    data-type="minor"
                  />
                  <path
                    d="M152.913 351.059L154.022 344.059"
                    data-type="minor"
                  />
                  <path
                    d="M162.026 351.059L162.762 344.059"
                    data-type="minor"
                  />
                  <path
                    d="M171.036 351.059L171.403 344.059"
                    data-type="minor"
                  />
                  <path d="M180 351L180 338" data-type="major" />
                  <path
                    d="M188.958 351.061L188.591 344.061"
                    data-type="minor"
                  />
                  <path d="M197.966 351.061L197.23 344.061" data-type="minor" />
                  <path d="M207.079 351.061L205.97 344.061" data-type="minor" />
                  <path
                    d="M216.343 351.061L214.855 344.061"
                    data-type="minor"
                  />
                  <path
                    d="M225.813 351.053L223.939 344.056"
                    data-type="minor"
                  />
                  <path
                    d="M235.546 351.016L233.278 344.035"
                    data-type="minor"
                  />
                  <path d="M245.571 350.906L242.905 343.96" data-type="minor" />
                  <path
                    d="M255.948 350.658L252.882 343.771"
                    data-type="minor"
                  />
                  <path
                    d="M263.185 343.341L266.646 350.133"
                    data-type="minor"
                  />
                  <path
                    d="M277.589 349.096L270.589 336.971"
                    data-type="major"
                  />
                  <path
                    d="M288.522 347.191L284.369 340.795"
                    data-type="minor"
                  />
                  <path
                    d="M299.063 343.936L294.637 337.843"
                    data-type="minor"
                  />
                  <path
                    d="M308.767 339.088L304.077 333.296"
                    data-type="minor"
                  />
                  <path
                    d="M317.696 332.988L312.747 327.491"
                    data-type="minor"
                  />
                  <path
                    d="M325.519 325.564L320.578 320.624"
                    data-type="minor"
                  />
                  <path d="M332.935 317.76L327.437 312.81" data-type="minor" />
                  <path
                    d="M339.034 308.828L333.242 304.138"
                    data-type="minor"
                  />
                  <path d="M343.882 299.127L337.789 294.7" data-type="minor" />
                  <path d="M347.136 288.586L340.74 284.432" data-type="minor" />
                  <path d="M349.04 277.652L336.916 270.652" data-type="major" />
                  <path
                    d="M343.287 263.248L350.079 266.709"
                    data-type="minor"
                  />
                  <path
                    d="M350.603 256.012L343.716 252.945"
                    data-type="minor"
                  />
                  <path
                    d="M350.853 245.635L343.906 242.968"
                    data-type="minor"
                  />
                  <path
                    d="M350.962 235.609L343.982 233.341"
                    data-type="minor"
                  />
                  <path
                    d="M350.999 225.877L344.002 224.002"
                    data-type="minor"
                  />
                  <path
                    d="M351.007 216.406L344.007 214.918"
                    data-type="minor"
                  />
                  <path
                    d="M351.007 207.143L344.007 206.034"
                    data-type="minor"
                  />
                  <path
                    d="M351.007 198.029L344.007 197.294"
                    data-type="minor"
                  />
                  <path d="M351.007 189.02L344.007 188.653" data-type="minor" />
                  <path d="M351 180L338 180" data-type="major" />
                  <path
                    d="M351.007 171.109L344.007 171.476"
                    data-type="minor"
                  />
                  <path d="M351.007 162.1L344.007 162.835" data-type="minor" />
                  <path
                    d="M351.007 152.986L344.007 154.095"
                    data-type="minor"
                  />
                  <path
                    d="M351.007 143.723L344.007 145.211"
                    data-type="minor"
                  />
                  <path
                    d="M350.999 134.252L344.002 136.127"
                    data-type="minor"
                  />
                  <path d="M350.962 124.52L343.982 126.788" data-type="minor" />
                  <path
                    d="M350.853 114.494L343.906 117.161"
                    data-type="minor"
                  />
                  <path
                    d="M350.604 104.117L343.718 107.183"
                    data-type="minor"
                  />
                  <path
                    d="M343.287 96.8807L350.079 93.4199"
                    data-type="minor"
                  />
                  <path
                    d="M349.042 82.4766L336.918 89.4766"
                    data-type="major"
                  />
                  <path d="M347.138 71.543L340.742 75.6966" data-type="minor" />
                  <path d="M343.882 61.002L337.789 65.4287" data-type="minor" />
                  <path
                    d="M339.034 51.3008L333.242 55.9908"
                    data-type="minor"
                  />
                  <path
                    d="M332.935 42.3691L327.437 47.3189"
                    data-type="minor"
                  />
                  <path d="M325.521 34.5645L320.58 39.5049" data-type="minor" />
                  <path
                    d="M317.706 27.1328L312.756 32.6301"
                    data-type="minor"
                  />
                  <path
                    d="M308.775 21.0332L304.085 26.8249"
                    data-type="minor"
                  />
                  <path
                    d="M299.073 16.1836L294.647 22.2765"
                    data-type="minor"
                  />
                  <path
                    d="M288.532 12.9297L284.379 19.3257"
                    data-type="minor"
                  />
                  <path
                    d="M277.599 11.0254L270.599 23.1497"
                    data-type="major"
                  />
                  <path
                    d="M263.194 16.7805L266.655 9.98828"
                    data-type="minor"
                  />
                  <path
                    d="M255.958 9.46289L252.892 16.3497"
                    data-type="minor"
                  />
                  <path
                    d="M245.581 9.21484L242.915 16.1613"
                    data-type="minor"
                  />
                  <path
                    d="M235.556 9.10547L233.288 16.0858"
                    data-type="minor"
                  />
                  <path
                    d="M225.823 9.06641L223.948 16.0636"
                    data-type="minor"
                  />
                  <path
                    d="M216.353 9.06055L214.865 16.0605"
                    data-type="minor"
                  />
                  <path d="M207.089 9.06055L205.98 16.0605" data-type="minor" />
                  <path d="M197.976 9.06055L197.24 16.0605" data-type="minor" />
                  <path
                    d="M188.966 9.06055L188.599 16.0605"
                    data-type="minor"
                  />
                  <path d="M180 9V22" data-type="major" />
                </svg>
              </div>
              <div
                className="flex items-center justify-center"
                style={{
                  filter: `hue-rotate(calc(0deg - var(--sky-phase, 0) * 30deg)) saturate(calc(1 + var(--sky-phase, 0) * 1.5)) brightness(${1 - easeInBack(skyPhaseFraction) * 0.5})`,
                  clipPath:
                    "path('M2 155.6C2 101.835 2 74.9524 12.4634 54.4169C21.6672 36.3534 36.3534 21.6672 54.4169 12.4634C74.9524 2 101.835 2 155.6 2H208.4C262.165 2 289.048 2 309.583 12.4634C327.647 21.6672 342.333 36.3534 351.537 54.4169C362 74.9524 362 101.835 362 155.6V208.4C362 262.165 362 289.048 351.537 309.583C342.333 327.647 327.647 342.333 309.583 351.537C289.048 362 262.165 362 208.4 362H155.6C101.835 362 74.9524 362 54.4169 351.537C36.3534 342.333 21.6672 327.647 12.4634 309.583C2 289.048 2 262.165 2 208.4V155.6Z')",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to bottom, ${interpolatedColors[2]} 0%, ${interpolatedColors[5]} 100%)`,
                  }}
                ></div>
                <div className="relative w-91 h-91">
                  {/* top edge */}
                  <svg
                    className="absolute inset-0 mask-[linear-gradient(to_bottom,white_5%,transparent_33%)] blur-[2px]"
                    width="364"
                    height="364"
                    viewBox="0 0 364 364"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 157.874C2 104.713 2 78.1328 12.4634 57.828C21.6672 39.9674 36.3534 25.4462 54.4169 16.3458C74.9524 6 101.835 6 155.6 6H208.4C262.165 6 289.048 6 309.583 16.3458C327.647 25.4462 342.333 39.9674 351.537 57.828C362 78.1328 362 104.713 362 157.874V206.126C362 259.287 362 285.867 351.537 306.172C342.333 324.033 327.647 338.554 309.583 347.654C289.048 358 262.165 358 208.4 358H155.6C101.835 358 74.9524 358 54.4169 347.654C36.3534 338.554 21.6672 324.033 12.4634 306.172C2 285.867 2 259.287 2 206.126V157.874Z"
                      stroke={interpolatedColors[2]}
                      strokeWidth="4"
                    />
                    <path
                      d="M2 155.6C2 101.835 2 74.9524 12.4634 54.4169C21.6672 36.3534 36.3534 21.6672 54.4169 12.4634C74.9524 2 101.835 2 155.6 2H208.4C262.165 2 289.048 2 309.583 12.4634C327.647 21.6672 342.333 36.3534 351.537 54.4169C362 74.9524 362 101.835 362 155.6V208.4C362 262.165 362 289.048 351.537 309.583C342.333 327.647 327.647 342.333 309.583 351.537C289.048 362 262.165 362 208.4 362H155.6C101.835 362 74.9524 362 54.4169 351.537C36.3534 342.333 21.6672 327.647 12.4634 309.583C2 289.048 2 262.165 2 208.4V155.6Z"
                      stroke={interpolatedColors[1]}
                      strokeWidth="4"
                    />
                  </svg>
                  {/* bottom edge */}
                  <svg
                    className="absolute inset-0 mask-[linear-gradient(to_top,white_5%,transparent_33%)] blur-[2px]"
                    width="364"
                    height="364"
                    viewBox="0 0 364 364"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* <path
                  d="M2 166.565C2 115.962 2 90.6611 12.4634 71.3336C21.6672 54.3326 36.3534 40.5103 54.4169 31.8479C74.9524 22 101.835 22 155.6 22H208.4C262.165 22 289.048 22 309.583 31.8479C327.647 40.5103 342.333 54.3326 351.537 71.3336C362 90.6611 362 115.962 362 166.565V197.435C362 248.038 362 273.339 351.537 292.666C342.333 309.667 327.647 323.49 309.583 332.152C289.048 342 262.165 342 208.4 342H155.6C101.835 342 74.9524 342 54.4169 332.152C36.3534 323.49 21.6672 309.667 12.4634 292.666C2 273.339 2 248.038 2 197.435V166.565Z"
                  stroke={interpolatedColors[4]}
                  strokeWidth="4"
                /> */}
                    <path
                      d="M2 164.456C2 113.191 2 87.5593 12.4634 67.9789C21.6672 50.7555 36.3534 36.7525 54.4169 27.9767C74.9524 18 101.835 18 155.6 18H208.4C262.165 18 289.048 18 309.583 27.9767C327.647 36.7525 342.333 50.7555 351.537 67.9789C362 87.5593 362 113.191 362 164.456V199.544C362 250.809 362 276.441 351.537 296.021C342.333 313.244 327.647 327.248 309.583 336.023C289.048 346 262.165 346 208.4 346H155.6C101.835 346 74.9524 346 54.4169 336.023C36.3534 327.248 21.6672 313.244 12.4634 296.021C2 276.441 2 250.809 2 199.544V164.456Z"
                      stroke={interpolatedColors[5]}
                      strokeWidth="4"
                    />
                    <path
                      d="M2 162.303C2 110.392 2 84.4368 12.4634 64.6094C21.6672 47.1688 36.3534 32.989 54.4169 24.1026C74.9524 14 101.835 14 155.6 14H208.4C262.165 14 289.048 14 309.583 24.1026C327.647 32.989 342.333 47.1688 351.537 64.6094C362 84.4368 362 110.392 362 162.303V201.697C362 253.608 362 279.563 351.537 299.391C342.333 316.831 327.647 331.011 309.583 339.897C289.048 350 262.165 350 208.4 350H155.6C101.835 350 74.9524 350 54.4169 339.897C36.3534 331.011 21.6672 316.831 12.4634 299.391C2 279.563 2 253.608 2 201.697V162.303Z"
                      stroke={interpolatedColors[6]}
                      strokeWidth="4"
                    />
                    <path
                      d="M2 160.109C2 107.566 2 81.2944 12.4634 61.2256C21.6672 43.5726 36.3534 29.2202 54.4169 20.2256C74.9524 10 101.835 10 155.6 10H208.4C262.165 10 289.048 10 309.583 20.2256C327.647 29.2202 342.333 43.5726 351.537 61.2256C362 81.2944 362 107.566 362 160.109V203.891C362 256.434 362 282.706 351.537 302.774C342.333 320.427 327.647 334.78 309.583 343.774C289.048 354 262.165 354 208.4 354H155.6C101.835 354 74.9524 354 54.4169 343.774C36.3534 334.78 21.6672 320.427 12.4634 302.774C2 282.706 2 256.434 2 203.891V160.109Z"
                      stroke={interpolatedColors[7]}
                      strokeWidth="4"
                    />
                    <path
                      d="M2 157.874C2 104.713 2 78.1328 12.4634 57.828C21.6672 39.9674 36.3534 25.4462 54.4169 16.3458C74.9524 6 101.835 6 155.6 6H208.4C262.165 6 289.048 6 309.583 16.3458C327.647 25.4462 342.333 39.9674 351.537 57.828C362 78.1328 362 104.713 362 157.874V206.126C362 259.287 362 285.867 351.537 306.172C342.333 324.033 327.647 338.554 309.583 347.654C289.048 358 262.165 358 208.4 358H155.6C101.835 358 74.9524 358 54.4169 347.654C36.3534 338.554 21.6672 324.033 12.4634 306.172C2 285.867 2 259.287 2 206.126V157.874Z"
                      stroke={interpolatedColors[9]}
                      strokeWidth="4"
                    />
                    <path
                      d="M2 155.6C2 101.835 2 74.9524 12.4634 54.4169C21.6672 36.3534 36.3534 21.6672 54.4169 12.4634C74.9524 2 101.835 2 155.6 2H208.4C262.165 2 289.048 2 309.583 12.4634C327.647 21.6672 342.333 36.3534 351.537 54.4169C362 74.9524 362 101.835 362 155.6V208.4C362 262.165 362 289.048 351.537 309.583C342.333 327.647 327.647 342.333 309.583 351.537C289.048 362 262.165 362 208.4 362H155.6C101.835 362 74.9524 362 54.4169 351.537C36.3534 342.333 21.6672 327.647 12.4634 309.583C2 289.048 2 262.165 2 208.4V155.6Z"
                      stroke={interpolatedColors[12]}
                      strokeWidth="4"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="relative p-[0_32px_32px_32px] flex flex-col items-center gap-2">
            <div
              className="relative w-[calc(100%+64px)] h-[246px] mask-center mask-no-repeat overflow-hidden duration-200 ease-in-out"
              style={{
                maskImage: isDragging
                  ? "radial-gradient(ellipse 100% 45% at 50% 50%,white 75%,transparent 125%)"
                  : "radial-gradient(ellipse 150% 50% at 50% 50%,white 45%,rgba(255,255,255,0.9) 55%,transparent 100%)",
              }}
            >
              <div
                className="absolute w-full aspect-1782/911 duration-200 ease-in-out"
                style={{
                  transform: `scale(${isDragging ? 2 : 5}) translate(${isDragging ? "-53.25%, 20%" : "calc(-32% + var(--elapsed-x-norm, 0) * -42.5%), calc(30% + var(--elapsed-y-norm, 0) * -22%)"})`,
                }}
              >
                <div
                  className="absolute z-2 w-0.75 h-0.75 rounded-full bg-white duration-200 ease-in-out"
                  style={{
                    transform: `translate(-50%, -50%) scale(${isDragging ? 1 : 0.4})`,
                    top: `${65 - (times.origin.coordinates[0] / 90) * 54.5}%`,
                    left: `${46.6 + (times.origin.coordinates[1] / 180) * 50}%`,
                  }}
                />
                <div
                  className="absolute z-2 w-0.75 h-0.75 rounded-full bg-white duration-200 ease-in-out"
                  style={{
                    transform: `translate(-50%, -50%) scale(${isDragging ? 1 : 0.4})`,
                    top: `${65 - (times.destination.coordinates[0] / 90) * 54.5}%`,
                    left: `${146.6 + (times.destination.coordinates[1] / 180) * 50}%`,
                  }}
                />
                <div
                  className="absolute z-2"
                  style={{
                    width: `${((180 - Math.abs(times.origin.coordinates[1]) + (180 - Math.abs(times.destination.coordinates[1]))) / 180) * 50}%`,
                    top: `24%`,
                    left: `${46.6 + (times.origin.coordinates[1] / 180) * 50}%`,
                  }}
                >
                  <svg
                    className="w-full"
                    viewBox="0 0 762 190"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      className="duration-200 ease-in-out"
                      id="elapsedPath"
                      ref={elapsedPathRef}
                      d="M1.5652 169C0.0653739 167 -0.434779 163.5 4.06514 162C10.1929 159.957 11.0652 159.5 13.5651 164.5C13.5651 164.5 19.0652 174 21.0652 177C23.0652 180 26.5652 181 29.5652 179.5C32.5652 178 42.0646 173.5 45.5646 172C49.0646 170.5 51.5646 170 54.5646 170C57.5646 170 76.5646 171.002 79.5646 171.002C82.5646 171.002 85.0646 170.501 87.0646 168.501C89.0646 166.501 155.564 103.001 157.564 101.001C159.564 99.0007 162.564 97.4999 167.064 95.9999C171.564 94.4999 221.564 79.0007 232.564 73.5007C243.564 68.0007 279.902 47.7365 312.064 35.5007C346.207 22.5112 395.064 10.9999 402.064 10.0007C409.064 9.00155 437.564 10.0007 437.564 10.0007"
                      stroke="white"
                      style={{ strokeWidth: isDragging ? "0.5" : "0.2" }}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      className="duration-200 ease-in-out"
                      id="remainingPath"
                      ref={remainingPathRef}
                      d="M437.565 10C538.065 12 686.065 64 761.565 134"
                      stroke="rgba(255,255,255,0.25)"
                      style={{ strokeWidth: isDragging ? "0.5" : "0.2" }}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* airplane */}
                  <div
                    className="absolute z-3 w-2 aspect-square pointer-events-none transition-[width] duration-200 ease-in-out"
                    style={{
                      left: "calc(var(--elapsed-x-norm, 0) * 100%)",
                      top: "calc(var(--elapsed-y-norm, 0) * 100%)",
                      transform: `translate(-50%, -50%) rotate(calc(var(--elapsed-angle-deg, 0) * 1deg))`,
                      width: isDragging ? 10 : 6,
                    }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M19.5049 10.3963L15.5429 10.3963L9.60779 1.17287C9.49759 0.997719 9.32771 0.868386 9.12955 0.808774C8.93139 0.749161 8.71835 0.763299 8.5298 0.848575C8.34126 0.933851 8.18995 1.0845 8.10386 1.27267C8.01777 1.46085 8.00271 1.67383 8.06147 1.87224L10.3553 9.89261C10.3724 9.95228 10.3755 10.0151 10.3642 10.0761C10.3529 10.1372 10.3276 10.1948 10.2903 10.2444C10.253 10.294 10.2047 10.3343 10.1491 10.362C10.0936 10.3898 10.0324 10.4042 9.97031 10.4043L3.44173 10.4043L1.53289 7.54906C1.45971 7.4391 1.36052 7.34891 1.2441 7.28651C1.12769 7.22411 0.997673 7.19142 0.865591 7.19135H0.803032C0.67588 7.19119 0.550513 7.22127 0.437272 7.2791C0.324031 7.33693 0.226162 7.42085 0.151738 7.52395C0.0773146 7.62704 0.0284695 7.74636 0.00923235 7.87205C-0.0100048 7.99773 0.000917144 8.1262 0.0410973 8.24683L1.29388 12.0004L0.0427015 15.7539C0.00256421 15.8744 -0.00837787 16.0027 0.0107761 16.1283C0.02993 16.2539 0.0786322 16.3731 0.152873 16.4761C0.227114 16.5792 0.324771 16.6631 0.437805 16.7211C0.550838 16.779 0.676016 16.8093 0.803032 16.8094H0.865591C0.997673 16.8093 1.12769 16.7766 1.2441 16.7142C1.36052 16.6518 1.45971 16.5616 1.53289 16.4517L3.44173 13.5964L9.97031 13.5964C10.0324 13.5965 10.0936 13.611 10.1491 13.6387C10.2047 13.6665 10.253 13.7067 10.2903 13.7563C10.3276 13.806 10.3529 13.8635 10.3642 13.9246C10.3755 13.9856 10.3724 14.0485 10.3553 14.1081L8.06147 22.1285C8.00271 22.3269 8.01777 22.5399 8.10386 22.7281C8.18995 22.9162 8.34126 23.0669 8.5298 23.1522C8.71835 23.2374 8.93139 23.2516 9.12955 23.192C9.32771 23.1323 9.49759 23.003 9.60779 22.8279L15.5429 13.6044L19.5049 13.6044C20.7064 13.6044 21.895 13.412 23.0339 13.0334L23.3932 12.9147C24.2722 12.6227 24.2722 11.3796 23.3932 11.086L23.0339 10.9657C21.8955 10.5887 20.7041 10.3964 19.5049 10.3963Z"
                        fill="white"
                      />
                    </svg>
                  </div>
                </div>
                <div className="absolute inset-[0_auto_0_0] w-[200%]">
                  <svg
                    className="absolute z-1 inset-[0_auto_0_40.55%]"
                    ref={timezoneZoneSvgRef}
                    height="100%"
                    viewBox="0 0 833 911"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      id="zone-5"
                      d="M740.5 341.5L735 372H833V262H724.5L721 317L740.5 341.5Z"
                    />
                    <path
                      id="zone-6"
                      d="M746.5 187H662.5V242H623V317H721L727 223L746.5 187Z"
                    />
                    <path
                      id="zone-7"
                      d="M493 171L469.5 164.5V242H541.5L552.5 255L541.5 263.5L561.5 273.5L581.5 293L601.5 339H623V242H662.5V166H544.5L536.5 157L493 171Z"
                    />
                    <path
                      id="zone-8"
                      d="M541.5 242H480.5L487.5 250L496 244L516 263.5H541.5L552.5 255L541.5 242Z"
                    />
                    <path
                      id="zone-9"
                      d="M469.5 242V164.5L392.5 149.5L332 180V198L306.5 221V243L329 285V299L396 276L461.5 242V270.5H523.5L496 244L487.5 250L480.5 242H469.5Z"
                    />
                    <path
                      id="zone-10"
                      d="M329 285L306.5 243V221L228 291.5L277.5 325H461.5V242L396 276L329 299V285Z"
                    />
                    <path
                      id="zone+12"
                      d="M240 325H277.5L228 291.5L262.5 260.5H154V298.5L166 310.5H240V325Z"
                    />
                    <path
                      id="zone+11"
                      d="M108 340.5L110.5 357H240V310.5H166L154 298.5L83.5 336L108 340.5Z"
                    />
                    <path
                      id="zone+10"
                      d="M110.5 357L94 371V423H165.5V357H110.5Z"
                    />
                    <path
                      id="zone+9"
                      d="M108 340.5L83.5 336L64.5 358H26.5L1 373.5V423H94V371L110.5 357L108 340.5Z"
                    />
                  </svg>
                  {/* timezones and world map */}
                  <div
                    className="absolute w-full inset-0 bg-[auto_100%] bg-repeat-x duration-200 ease-in-out"
                    style={{
                      opacity: isDragging ? 0.75 : 1,
                      backgroundImage: "url('/world.png')",
                    }}
                  />
                  {timeZones.map((timezone) => (
                    <div
                      key={timezone}
                      className="absolute w-full inset-0 bg-[auto_100%] bg-repeat-x duration-200 ease-in-out"
                      style={{
                        filter: `hue-rotate(${15 - 20 * skyPhaseFraction}deg) brightness(${2 - skyPhaseFraction})`,
                        opacity: isDragging
                          ? currentTimezoneLabel === timezone
                            ? 0.5
                            : 0
                          : 0,
                        backgroundImage: `url('/timezones/${timezone.replace("UTC", "")}.png')`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full flex items-center justify-between text-(--white)/50">
              <h2>ICN</h2>
              <h2>{flightTime}</h2>
              <h2>YYZ</h2>
            </div>
            <div className="w-full relative h-8" ref={timelineRef}>
              <div className="absolute inset-0 bg-(--white)/10 border border-(--white)/20 rounded-xl" />
              <div
                className="absolute top-0 left-0 h-full aspect-square scale-200 flex items-center justify-center transition-transform duration-200"
                style={{ transform: `scale(${isDragging ? 1.25 : 1})` }}
                ref={timelineDragRef}
              >
                <div
                  className="absolute h-full aspect-square [scale:0.5] opacity-0 bg-(--white)/15 rounded-xl transition-[opacity,scale] duration-200"
                  ref={timelineDragVelocity}
                  style={{
                    opacity: isDragging ? 1 : 0,
                    scale: isDragging ? 1 : 0.5,
                  }}
                />
                <div className="w-6 h-6 aspect-square scale-50 flex items-center justify-center bg-(--white)/20 border border-(--white)/40 rounded-lg">
                  <svg
                    className="w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19.5049 10.3963L15.5429 10.3963L9.60779 1.17287C9.49759 0.997719 9.32771 0.868386 9.12955 0.808774C8.93139 0.749161 8.71835 0.763299 8.5298 0.848575C8.34126 0.933851 8.18995 1.0845 8.10386 1.27267C8.01777 1.46085 8.00271 1.67383 8.06147 1.87224L10.3553 9.89261C10.3724 9.95228 10.3755 10.0151 10.3642 10.0761C10.3529 10.1372 10.3276 10.1948 10.2903 10.2444C10.253 10.294 10.2047 10.3343 10.1491 10.362C10.0936 10.3898 10.0324 10.4042 9.97031 10.4043L3.44173 10.4043L1.53289 7.54906C1.45971 7.4391 1.36052 7.34891 1.2441 7.28651C1.12769 7.22411 0.997673 7.19142 0.865591 7.19135H0.803032C0.67588 7.19119 0.550513 7.22127 0.437272 7.2791C0.324031 7.33693 0.226162 7.42085 0.151738 7.52395C0.0773146 7.62704 0.0284695 7.74636 0.00923235 7.87205C-0.0100048 7.99773 0.000917144 8.1262 0.0410973 8.24683L1.29388 12.0004L0.0427015 15.7539C0.00256421 15.8744 -0.00837787 16.0027 0.0107761 16.1283C0.02993 16.2539 0.0786322 16.3731 0.152873 16.4761C0.227114 16.5792 0.324771 16.6631 0.437805 16.7211C0.550838 16.779 0.676016 16.8093 0.803032 16.8094H0.865591C0.997673 16.8093 1.12769 16.7766 1.2441 16.7142C1.36052 16.6518 1.45971 16.5616 1.53289 16.4517L3.44173 13.5964L9.97031 13.5964C10.0324 13.5965 10.0936 13.611 10.1491 13.6387C10.2047 13.6665 10.253 13.7067 10.2903 13.7563C10.3276 13.806 10.3529 13.8635 10.3642 13.9246C10.3755 13.9856 10.3724 14.0485 10.3553 14.1081L8.06147 22.1285C8.00271 22.3269 8.01777 22.5399 8.10386 22.7281C8.18995 22.9162 8.34126 23.0669 8.5298 23.1522C8.71835 23.2374 8.93139 23.2516 9.12955 23.192C9.32771 23.1323 9.49759 23.003 9.60779 22.8279L15.5429 13.6044L19.5049 13.6044C20.7064 13.6044 21.895 13.412 23.0339 13.0334L23.3932 12.9147C24.2722 12.6227 24.2722 11.3796 23.3932 11.086L23.0339 10.9657C21.8955 10.5887 20.7041 10.3964 19.5049 10.3963Z"
                      fill="white"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div
            className="opacity-0 scale-100 duration-300 ease-in-out"
            ref={edgesRef}
            style={{
              opacity: isDragging ? 1 : 0,
              transform: isDragging ? "scale(1,1)" : "scale(1.1,1.05)",
            }}
          >
            <Image
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[645px] aspect-653/1112 mask-[linear-gradient(to_bottom,white_50%,transparent_67%)]"
              src="/blurred-edge-1.png"
              alt="Blurred Edges Light"
              width={653}
              height={1112}
              style={{ opacity: `${1 - skyPhaseFraction}` }}
            />
            <Image
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[645px] aspect-653/1112 mask-[linear-gradient(to_bottom,white_50%,transparent_67%)]"
              src="/blurred-edge-2.png"
              alt="Blurred Edges Dark"
              width={653}
              height={1112}
              style={{ opacity: `${skyPhaseFraction}` }}
            />
          </div>
          <svg
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            width="573"
            height="1032"
            viewBox="0 0 573 1032"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M573 1032H0V0H573V1032ZM188.543 90C154.05 90 136.804 90.0002 123.629 96.7129C112.04 102.618 102.618 112.04 96.7129 123.629C90.0002 136.804 90 154.05 90 188.543V843.457C90 877.95 90.0002 895.196 96.7129 908.371C102.618 919.96 112.04 929.382 123.629 935.287C136.804 942 154.05 942 188.543 942H384.457C418.95 942 436.196 942 449.371 935.287C460.96 929.382 470.382 919.96 476.287 908.371C483 895.196 483 877.95 483 843.457V188.543C483 154.05 483 136.804 476.287 123.629C470.382 112.04 460.96 102.618 449.371 96.7129C436.196 90.0002 418.95 90 384.457 90H188.543Z"
              fill="var(--background)"
            />
          </svg>
        </div>
      </div>
    </main>
  );
}
