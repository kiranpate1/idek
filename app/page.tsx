"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import gradients from "./components/gradients";

const times = {
  origin: {
    location: "Seoul",
    coordinates: [37.5665, 126.978],
    takeoffTime: "2026-08-15T19:35:00Z",
    weather: "Clear",
  },
  current: {
    location: "unknown",
    coordinates: [13.3241, 2.3984],
    time: "2024-06-15T06:15:00Z",
    weather: "Clear",
  },
  destination: {
    location: "Toronto",
    coordinates: [43.65107, -79.347015],
    time: "2026-08-16T19:45:00Z",
    weather: "Clear",
  },
};

const offsetsRaw = [
  0, 0.01431, 0.03715, 0.061142, 0.076562, 0.093753, 0.117719, 0.144881,
  0.174599, 0.205915, 0.245539, 0.297306, 0.354049, 0.490883, 0.643181, 1,
];
const offsetsRoot = 0.7;
const offsets = offsetsRaw.map((o) => offsetsRoot + o * (1 - offsetsRoot));

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

function calculateSkyPhase(flightProgress: number): {
  skyPhase: number;
  time: string;
} {
  const clampedProgress = Math.min(1, Math.max(0, flightProgress));

  // Calculate flight clock time from takeoff + elapsed progress.
  const takeoffTime = times.origin.takeoffTime;
  const landingTime = times.destination.time;
  const takeoffTimestamp = new Date(takeoffTime).getTime();
  const landingTimestamp = new Date(landingTime).getTime();
  const totalFlightTimeSeconds = Math.max(
    0,
    (landingTimestamp - takeoffTimestamp) / 1000,
  );

  const elapsedFlightTime = totalFlightTimeSeconds * clampedProgress;

  const currentFlightTimestamp =
    takeoffTimestamp + Math.floor(elapsedFlightTime * 1000);
  const currentFlightDate = new Date(currentFlightTimestamp);

  const hours = currentFlightDate.getUTCHours();
  const minutes = currentFlightDate.getUTCMinutes();
  const seconds = currentFlightDate.getUTCSeconds();

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");
  const flightTimeString = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

  // Sky phase stays progress-driven. These breakpoints are tuned so
  // sunrise/sunset are short windows (~2h each) on a 24h10m flight arc.
  const maxPhase = gradients.length - 1;
  const nightPhase = 0;
  const dayPhase = maxPhase;
  const sunsetPhase = maxPhase * 0.5;

  const keyframes = [
    { progress: 0, phase: sunsetPhase },
    { progress: 0.072, phase: nightPhase },
    { progress: 0.3, phase: nightPhase },
    { progress: 0.562, phase: dayPhase },
    { progress: 0.917, phase: dayPhase },
    { progress: 1, phase: sunsetPhase },
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
      return { skyPhase: phase, time: flightTimeString };
    }
  }

  return {
    skyPhase: sunsetPhase,
    time: flightTimeString,
  };
}

export default function Home() {
  const [flightProgress, setFlightProgress] = useState(0);
  const [skyPhase, setSkyPhase] = useState(0);
  const [skyPhaseFraction, setSkyPhaseFraction] = useState(0);
  const [flightTime, setFlightTime] = useState("00:00:00");
  const mainRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineDragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timelineRef.current && timelineDragRef.current) {
      const timeline = timelineRef.current;
      const dragElement = timelineDragRef.current;

      const handleMouseMove = (event: MouseEvent) => {
        const rect = timeline.getBoundingClientRect();
        let newLeft = event.clientX - rect.left - dragElement.offsetWidth / 2;
        newLeft = Math.max(
          0,
          Math.min(newLeft, rect.width - dragElement.offsetWidth),
        );
        dragElement.style.left = `${newLeft}px`;
        setFlightProgress(newLeft / (rect.width - dragElement.offsetWidth));
      };

      const handleTouchMove = (event: TouchEvent) => {
        const rect = timeline.getBoundingClientRect();
        let newLeft =
          event.touches[0].clientX - rect.left - dragElement.offsetWidth / 2;
        newLeft = Math.max(
          0,
          Math.min(newLeft, rect.width - dragElement.offsetWidth),
        );
        dragElement.style.left = `${newLeft}px`;
        setFlightProgress(newLeft / (rect.width - dragElement.offsetWidth));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleMouseUp);
      };

      const handleMouseDown = () => {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleMouseUp);
      };

      dragElement.addEventListener("mousedown", handleMouseDown);
      dragElement.addEventListener("touchstart", handleMouseDown);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleMouseUp);
        dragElement.removeEventListener("mousedown", handleMouseDown);
        dragElement.removeEventListener("touchstart", handleMouseDown);
      };
    }
  }, []);

  useEffect(() => {
    if (!mainRef.current) return;
    const newSkyPhaseFraction = 1 - skyPhase / (gradients.length - 1);
    setSkyPhaseFraction(newSkyPhaseFraction);
    mainRef.current.style.setProperty(
      "--sky-phase",
      newSkyPhaseFraction.toString(),
    );
  }, [skyPhase]);

  useEffect(() => {
    const { skyPhase: newSkyPhase, time: newFlightTime } =
      calculateSkyPhase(flightProgress);
    setSkyPhase(newSkyPhase);
    setFlightTime(newFlightTime);
  }, [flightProgress]);

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

  return (
    <main
      className="w-dvw h-dvh flex flex-col items-center justify-center overflow-hidden"
      ref={mainRef}
    >
      <div className="relative w-[393px] h-[852px] bg-white">
        <Image
          className="absolute z-100 inset-[0_0_auto_0] pointer-events-none select-none"
          src="/dynamic-island.png"
          alt="Logo"
          width={600}
          height={600}
        />
        <svg
          className="absolute inset-0 z-0"
          style={{
            filter: `hue-rotate(calc(0deg - var(--sky-phase, 0) * 30deg)) saturate(calc(1 + var(--sky-phase, 0) * 1.5)) brightness(${1 - easeInBack(skyPhaseFraction) * 0.5})`,
          }}
          width="100%"
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
              gradientTransform="translate(191.5 426) scale(2 1.5)"
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
        <div
          className="absolute inset-[150px_32px_auto_32px] h-4 bg-white/15"
          ref={timelineRef}
        >
          <div
            className="absolute top-0 left-0 w-4 h-4 bg-white"
            ref={timelineDragRef}
          ></div>
        </div>
        <h1 className="absolute z-1 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-4xl font-bold">
          {flightTime}
        </h1>
      </div>
    </main>
  );
}
