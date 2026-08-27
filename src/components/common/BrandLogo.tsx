"use client";

import React from "react";

export interface BrandLogoProps {
  className?: string;
  color?: string;
  size?: number | string;
  variant?: "plain" | "badge" | "icon" | "glow";
  animated?: boolean;
}

/**
 * 5-Segment Stylized 'C' Hexagonal Brand Logo
 * Color: Modern Aqua / Cyan (#56C5D9)
 */
export default function BrandLogo({
  className = "h-6 w-6",
  color = "#56C5D9",
  size,
  variant = "plain",
  animated = false,
}: BrandLogoProps) {
  const logoSvg = (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 ${
        animated ? "group-hover:rotate-6 group-hover:scale-105" : ""
      } ${className}`}
      style={size ? { width: size, height: size } : undefined}
      aria-label="AI Chat Brand Logo"
    >
      <g fill={color}>
        {/* Top-Right Petal */}
        <path d="M 108.03 74.87 Q 108.75 84.84 118.06 81.19 L 157.71 65.61 Q 174.46 59.03 159.46 49.09 L 118.50 21.94 Q 103.50 12.00 104.79 29.95 Z" />
        {/* Top-Left Petal */}
        <path d="M 81.94 81.19 Q 91.25 84.84 91.97 74.87 L 95.21 29.95 Q 96.50 12.00 81.50 21.94 L 40.54 49.09 Q 25.54 59.03 42.29 65.61 Z" />
        {/* Middle-Left Petal */}
        <path d="M 74.61 106.14 Q 82.50 100.00 74.61 93.86 L 36.25 64.02 Q 22.04 52.97 22.04 70.97 L 22.04 129.03 Q 22.04 147.03 36.25 135.98 Z" />
        {/* Bottom-Left Petal */}
        <path d="M 91.97 125.13 Q 91.25 115.16 81.94 118.81 L 42.29 134.39 Q 25.54 140.97 40.54 150.91 L 81.50 178.06 Q 96.50 188.00 95.21 170.05 Z" />
        {/* Bottom-Right Petal */}
        <path d="M 118.06 118.81 Q 108.75 115.16 108.03 125.13 L 104.79 170.05 Q 103.50 188.00 118.50 178.06 L 159.46 150.91 Q 174.46 140.97 157.71 134.39 Z" />
      </g>
    </svg>
  );

  if (variant === "badge") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50/80 border border-cyan-200/60 shadow-2xs transition-all duration-200 hover:scale-105 hover:bg-cyan-50">
        {logoSvg}
      </div>
    );
  }

  if (variant === "glow") {
    return (
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-[#56C5D9]/20 blur-xl scale-125 pointer-events-none" />
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white border border-cyan-100 shadow-sm">
          {logoSvg}
        </div>
      </div>
    );
  }

  return logoSvg;
}
