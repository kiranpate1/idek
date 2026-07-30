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
  const timelineDragVelocity = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      timelineRef.current &&
      timelineDragRef.current &&
      timelineDragVelocity.current
    ) {
      const timeline = timelineRef.current;
      const dragElement = timelineDragRef.current;
      const velocityElement = timelineDragVelocity.current;

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

        //velo
        const velocity = event.touches[0].clientX - event.touches[0].clientX;
        velocityElement.style.transform = `scaleX(${1 + velocity * 5})`;
        setFlightProgress(newLeft / (rect.width - dragElement.offsetWidth));
      };

      const handleMouseUp = () => {
        dragElement.classList.replace("scale-250", "scale-200");
        velocityElement.classList.replace("opacity-100", "opacity-0");
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleMouseUp);
      };

      const handleMouseDown = () => {
        dragElement.classList.replace("scale-200", "scale-250");
        velocityElement.classList.replace("opacity-0", "opacity-100");
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
          className="absolute inset-0 z-0 pointer-events-none"
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
          className="absolute inset-[150px_32px_auto_32px] h-8"
          ref={timelineRef}
        >
          <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl squircle" />
          <div
            className="absolute top-0 left-0 h-full aspect-square scale-200 flex items-center justify-center transition-transform duration-200"
            ref={timelineDragRef}
          >
            <div
              className="absolute h-full aspect-square opacity-0 bg-white/10 rounded-2xl squircle transition-opacity duration-200"
              ref={timelineDragVelocity}
            />
            <div className="w-6 h-6 aspect-square scale-50 flex items-center justify-center bg-white/10 border border-white/20 rounded-lg squircle">
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
        <h1 className="absolute z-1 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-4xl font-bold pointer-events-none select-none">
          {flightTime}
        </h1>
      </div>
    </main>
  );
}
