"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const W = 1600;
const H = 840;
const CX = 800;
const CY = 420;
const CR = 230;

const items = {
  left: [
    { label: "Mentorship", tipX: 470, tipY: 180 },
    { label: "Workspace", tipX: 430, tipY: 420 },
    { label: "Prototyping Studio", tipX: 470, tipY: 660 },
  ],
  right: [
    { label: "Funding Support", tipX: 1130, tipY: 180 },
    { label: "Legal & IP Advisory", tipX: 1170, tipY: 420 },
    { label: "Network Access", tipX: 1130, tipY: 660 },
  ],
};

const mobileItems = [
  items.left[0], items.right[0],
  items.left[1], items.right[1],
  items.left[2], items.right[2],
];

const FONT = "Hanken Grotesk, sans-serif";

const pillStyle: React.CSSProperties = {
  background: "linear-gradient(to bottom, #F12837 0%, #700333 100%)",
  boxShadow: "0 8px 24px rgba(112,3,51,0.38), inset 0 1px 3px rgba(255,255,255,0.18)",
  fontFamily: FONT,
};

function getCircleEdgePoint(cx: number, cy: number, r: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return {
    x: cx + r * (dx / dist),
    y: cy + r * (dy / dist),
  };
}

export default function ServicesHub() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full bg-[#F5F6F7] flex justify-center lg:items-center overflow-hidden lg:min-h-screen relative py-8"
    >
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 flex flex-col lg:flex-row justify-center items-center lg:h-full">
        
        {/* DESKTOP LAYOUT (Large Radial Diagram) */}
        <div className="hidden lg:block relative w-full max-h-[90vh]" style={{ aspectRatio: `${W}/${H}` }}>
          <div className="absolute inset-0">
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" style={{ zIndex: 1, overflow: 'visible' }}>
              {items.left.map((item, i) => {
                const edge = getCircleEdgePoint(CX, CY, CR, item.tipX, item.tipY);
                return (
                  <line
                    key={item.label}
                    x1={edge.x} y1={edge.y} x2={item.tipX + 2} y2={item.tipY}
                    stroke="#111111" strokeWidth="4" strokeDasharray="12 10" strokeLinecap="round"
                    opacity={visible ? 0.8 : 0}
                    style={{ transition: `opacity 0.6s ease ${0.25 + i * 0.1}s` }}
                  />
                );
              })}

              {items.right.map((item, i) => {
                const edge = getCircleEdgePoint(CX, CY, CR, item.tipX, item.tipY);
                return (
                  <line
                    key={item.label}
                    x1={edge.x} y1={edge.y} x2={item.tipX - 2} y2={item.tipY}
                    stroke="#111111" strokeWidth="4" strokeDasharray="12 10" strokeLinecap="round"
                    opacity={visible ? 0.8 : 0}
                    style={{ transition: `opacity 0.6s ease ${0.25 + i * 0.1}s` }}
                  />
                );
              })}
            </svg>

            {/* Left Pills */}
            {items.left.map((item, i) => (
              <div
                key={item.label}
                className="absolute flex items-center justify-end"
                style={{
                  right: `${(1 - item.tipX / W) * 100}%`, top: `${(item.tipY / H) * 100}%`,
                  transform: visible ? "translate(0, -50%)" : "translate(-24px, -50%)",
                  zIndex: 3, opacity: visible ? 1 : 0,
                  transition: `opacity 0.55s ease ${0.1 + i * 0.12}s, transform 0.55s ease ${0.1 + i * 0.12}s`,
                }}
              >
                <div
                  className="rounded-full px-6 py-3 lg:px-9 lg:py-4 text-white font-semibold whitespace-nowrap cursor-default transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
                  style={{ ...pillStyle, fontSize: "clamp(12px, 1.6vw, 20px)", display: "flex", alignItems: "center" }}
                >
                  {item.label}
                </div>
              </div>
            ))}

            {/* Right Pills */}
            {items.right.map((item, i) => (
              <div
                key={item.label}
                className="absolute flex items-center justify-start"
                style={{
                  left: `${(item.tipX / W) * 100}%`, top: `${(item.tipY / H) * 100}%`,
                  transform: visible ? "translate(0, -50%)" : "translate(24px, -50%)",
                  zIndex: 3, opacity: visible ? 1 : 0,
                  transition: `opacity 0.55s ease ${0.1 + i * 0.12}s, transform 0.55s ease ${0.1 + i * 0.12}s`,
                }}
              >
                <div
                  className="rounded-full px-6 py-3 lg:px-9 lg:py-4 text-white font-semibold whitespace-nowrap cursor-default transition-transform duration-300 hover:-translate-y-1 hover:scale-105"
                  style={{ ...pillStyle, fontSize: "clamp(12px, 1.6vw, 20px)", display: "flex", alignItems: "center" }}
                >
                  {item.label}
                </div>
              </div>
            ))}

            {/* Center circle */}
            <div
              className="absolute"
              style={{
                left: `${((CX - CR) / W) * 100}%`, top: `${((CY - CR) / H) * 100}%`,
                width: `${(CR * 2 / W) * 100}%`, height: `${(CR * 2 / H) * 100}%`,
                zIndex: 2, opacity: visible ? 1 : 0, 
                transform: visible ? "scale(1)" : "scale(0.88)",
                transition: "opacity 0.7s ease 0.05s, transform 0.7s ease 0.05s",
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <Image src="/assets/servicehub.png" alt="What We Offer" fill style={{ objectFit: "contain" }} priority />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[22%]">
                  <p className="font-semibold tracking-[0.18em] uppercase text-gray-400 mb-1 sm:mb-2" style={{ fontFamily: FONT, fontSize: "clamp(7px, 0.8vw, 12px)" }}>What We Offer</p>
                  <h2 className="font-bold text-gray-900 leading-tight" style={{ fontFamily: FONT, fontSize: "clamp(10px, 1.8vw, 25px)" }}>Six things that actually move the needle.</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE LAYOUT (2-Column Grid) */}
        <div className="lg:hidden flex flex-col items-center w-full pt-2 pb-4">
          
          <div 
            className="relative w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] transition-all duration-700 mb-2 sm:mb-4"
            style={{ 
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.9)" 
            }}
          >
            <Image src="/assets/servicehub.png" alt="What We Offer" fill style={{ objectFit: "contain" }} priority />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-[22%] pointer-events-none">
              <p className="font-semibold tracking-[0.18em] uppercase text-gray-400 mb-1 sm:mb-2" style={{ fontFamily: FONT, fontSize: "clamp(9px, 2.5vw, 11px)" }}>What We Offer</p>
              <h2 className="font-bold text-gray-900 leading-tight text-[17px] sm:text-[21px]" style={{ fontFamily: FONT }}>Six things that actually move the needle.</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-[500px] px-2">
            {mobileItems.map((item, i) => (
              <div
                key={item.label}
                className="w-full flex justify-center"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(24px)",
                  transition: `opacity 0.5s ease ${0.3 + (i % 2) * 0.1 + Math.floor(i / 2) * 0.15}s, transform 0.5s ease ${0.3 + (i % 2) * 0.1 + Math.floor(i / 2) * 0.15}s`,
                }}
              >
                <div
                  className="rounded-[2.5rem] px-3 py-3 w-full text-center text-white font-semibold cursor-default transition-transform duration-300 hover:-translate-y-1 hover:scale-105 shadow-md flex items-center justify-center min-h-[56px]"
                  style={{ ...pillStyle, fontSize: "clamp(12px, 3.2vw, 15px)", lineHeight: "1.2" }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}