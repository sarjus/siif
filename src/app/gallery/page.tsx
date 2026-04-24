'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const galleryItems = [
  {
    src: '/assets/gallery/SIIF-Front.jpg',
    title: 'SIIF Main Building',
    description: 'The entrance to our incubation and innovation hub.',
  },
  {
    src: '/assets/gallery/SIIF-1.jpg',
    title: 'Collaborative Workspace',
    description: 'Open and flexible spaces where startup teams build together.',
  },
  {
    src: '/assets/gallery/SIIF-2.jpg',
    title: 'Startup Work Area',
    description: 'Dedicated workstations designed for focused execution.',
  },
  {
    src: '/assets/gallery/SIIF-3.jpg',
    title: 'Innovation Floor',
    description: 'A dynamic environment for mentoring, events, and growth.',
  },
];

export default function GalleryPage() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % galleryItems.length);
  };

  const previousSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % galleryItems.length);
    }, 4500);

    return () => clearInterval(intervalId);
  }, []);

  const activeItem = galleryItems[currentIndex];

  return (
    <main
      className="min-h-screen bg-[#f5f6f7]"
      style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}
    >
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 md:px-6 md:pt-20">
        <div className="mb-8 text-center md:mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#4A4A4A] md:text-5xl">
            SIIF Gallery
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#6A6A6A] md:text-lg">
            Explore highlights from our facilities and innovation spaces.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
          <div className="relative aspect-[16/9] w-full">
            <Image
              key={activeItem.src}
              src={activeItem.src}
              alt={activeItem.title}
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-4 md:p-6">
              <div>
                <h2 className="text-xl font-semibold text-white md:text-3xl">{activeItem.title}</h2>
                <p className="mt-1 max-w-xl text-sm text-white/85 md:text-base">{activeItem.description}</p>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={previousSlide}
                  className="rounded-full border border-white/35 bg-black/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/50"
                  aria-label="Previous slide"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="rounded-full border border-white/35 bg-black/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/50"
                  aria-label="Next slide"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-black/5 p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {galleryItems.map((item, index) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Open ${item.title}`}
                  className={`group relative overflow-hidden rounded-xl border transition ${
                    currentIndex === index
                      ? 'border-[#E81116] ring-2 ring-[#E81116]/25'
                      : 'border-black/10 hover:border-black/20'
                  }`}
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={item.src}
                      alt={item.title}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 md:hidden">
              <button
                type="button"
                onClick={previousSlide}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#4A4A4A] transition hover:bg-black/5"
                aria-label="Previous slide"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#4A4A4A] transition hover:bg-black/5"
                aria-label="Next slide"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
