'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useEffect } from 'react';

const galleryImages = [
  { src: '/assets/gallery/SIIF-Front.jpg', caption: 'SIIF Incubator Building' },
  { src: '/assets/gallery/SIIF-3.jpg', caption: 'Open Innovation Floor' },
  { src: '/assets/gallery/SIIF-1.jpg', caption: 'Collaborative Workspaces' },
  { src: '/assets/gallery/SIIF-2.jpg', caption: 'Startup Workstations' },
];

const features = [
  {
    icon: '🏢',
    title: 'Dedicated Workstations',
    desc: 'Ergonomically designed private desks with high-speed internet, power backup, and secure storage for every resident startup.',
  },
  {
    icon: '🤝',
    title: 'Collaborative Spaces',
    desc: 'Open co-working zones and breakout areas designed to spark spontaneous collaboration between founders and teams.',
  },
  {
    icon: '🏛️',
    title: 'Conference & Meeting Rooms',
    desc: 'Fully equipped meeting rooms with AV setups, whiteboards, and video conferencing for client and investor meetings.',
  },
  {
    icon: '⚡',
    title: 'High-Speed Connectivity',
    desc: 'Fibre-grade internet connectivity with redundancy and dedicated bandwidth to keep your team productive 24/7.',
  },
  {
    icon: '🔒',
    title: 'Secure 24×7 Access',
    desc: 'Round-the-clock access with biometric entry, CCTV surveillance, and on-site security for your peace of mind.',
  },
  {
    icon: '☕',
    title: 'Amenities & Lounge',
    desc: 'Cafeteria, recreation lounge, and wellness corner to help founders recharge between intense work sessions.',
  },
];

export default function FacilitiesPage() {
  const trackRef = useRef<HTMLDivElement>(null);

  // Duplicate images for seamless infinite scroll
  const loopImages = [...galleryImages, ...galleryImages];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame: number;
    let pos = 0;
    const speed = 0.5; // px per frame
    const singleWidth = track.scrollWidth / 2;

    const animate = () => {
      pos += speed;
      if (pos >= singleWidth) pos = 0;
      track.style.transform = `translateX(-${pos}px)`;
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif', backgroundColor: '#fff' }}>

      {/* ── Hero ── */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden">
        <Image
          src="/assets/gallery/SIIF-Front.jpg"
          alt="SIIF Incubator"
          fill
          className="object-cover object-center"
          priority
        />
        {/* dark gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)' }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{ backgroundColor: '#FF3B3B', color: '#fff', letterSpacing: '0.04em' }}
          >
            World-Class Infrastructure
          </span>
          <h1
            className="text-4xl md:text-6xl font-black text-white mb-4"
            style={{ letterSpacing: '-1.5px', lineHeight: 1.1 }}
          >
            Our Facilities
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
            A purpose-built innovation hub designed to help startups focus on what matters — building great products.
          </p>
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="py-20 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ color: '#111', letterSpacing: '-0.8px' }}
          >
            Everything You Need to <span style={{ color: '#FF3B3B' }}>Build & Grow</span>
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            From day one, SIIF provides the infrastructure so founders can stay focused on innovation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 border border-gray-100 hover:border-[#FF3B3B]/30 hover:shadow-md transition-all duration-300 group"
              style={{ backgroundColor: '#FAFAFA' }}
            >
              <span className="text-3xl mb-4 block">{f.icon}</span>
              <h3
                className="text-base font-bold mb-2 group-hover:text-[#FF3B3B] transition-colors"
                style={{ color: '#111' }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Auto-Scroll Gallery ── */}
      <section className="py-16" style={{ backgroundColor: '#F5F6F7' }}>
        <div className="text-center mb-10 px-6">
          <h2
            className="text-3xl md:text-4xl font-black mb-3"
            style={{ color: '#111', letterSpacing: '-0.8px' }}
          >
            A Look Inside<span style={{ color: '#FF3B3B' }}>.</span>
          </h2>
          <p className="text-gray-500 text-base">Take a virtual tour of our incubation space.</p>
        </div>

        {/* Gallery strip */}
        <div className="overflow-hidden">
          <div ref={trackRef} className="flex gap-4 w-max" style={{ willChange: 'transform' }}>
            {loopImages.map((img, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 rounded-2xl overflow-hidden"
                style={{ width: '480px', height: '300px' }}
              >
                <Image
                  src={img.src}
                  alt={img.caption}
                  fill
                  className="object-cover"
                />
                <div
                  className="absolute bottom-0 left-0 right-0 px-4 py-3"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
                >
                  <p className="text-white text-sm font-semibold">{img.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 text-center">
        <h2
          className="text-3xl md:text-4xl font-black mb-4"
          style={{ color: '#111', letterSpacing: '-0.8px' }}
        >
          Ready to Move In<span style={{ color: '#FF3B3B' }}>?</span>
        </h2>
        <p className="text-gray-500 text-base mb-8 max-w-lg mx-auto">
          Apply for incubation and get access to all these facilities from day one.
        </p>
        <Link
          href="/apply-incubation"
          className="inline-block px-8 py-3.5 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-all duration-300 shadow-lg"
          style={{ backgroundColor: '#FF3B3B', letterSpacing: '0.02em' }}
        >
          Apply for Incubation →
        </Link>
      </section>

    </main>
  );
}

