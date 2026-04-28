"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-center pt-12 md:pt-20 overflow-hidden bg-white">

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="relative z-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] gap-4 items-start">

          <div className="flex flex-col space-y-8 pt-2 md:pt-6">
            <h1
              className="tracking-tighter"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(2.5rem, 5vw, 89.665px)',
                fontWeight: 600,
                lineHeight: '98.155%',
                letterSpacing: '-3.587px',
                width: 'auto',
                minHeight: 'auto',
                maxWidth: '100%',
              }}
            >
              <span style={{
                background: 'linear-gradient(180deg, #5D5B5B 63.86%, #D5D0D0 89.74%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Build on Campus <br />
                Launch to the 
              </span>{" "}
              <span style={{
                background: 'linear-gradient(90deg, #2AA0D3 0%, #F00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                World
              </span>
              <span style={{
                background: 'linear-gradient(180deg, #5D5B5B 0%, #D6CCCC 89.74%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                .
              </span>
            </h1>

            <p
              className="max-w-2xl"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(1.05rem, 1.7vw, 19px)',
                fontWeight: 500,
                lineHeight: '1.6',
              }}
            >
              <span style={{ color: '#565555' }}>
                SIIF is the startup incubator of St. Joseph&apos;s College of Engineering and Technology, Palai.
              </span>
            </p>

          </div>

          <div className="flex flex-col items-end space-y-6 lg:pt-28">
            <Link href="/apply-incubation">
              <Button
                size="lg"
                className="text-white px-8 py-5 text-base md:text-lg font-bold shadow-xl transition-all hover:scale-105 active:scale-95 border-none"
                style={{
                  fontFamily: 'var(--font-hanken-grotesk)',
                  borderRadius: '74px',
                  background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
                }}
              >
                Apply for Incubation
              </Button>
            </Link>

            <div
              className="text-right ml-auto mt-6 md:mt-12 pb-8 max-w-[420px]"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%'
              }}
            >
              <h3
                className="font-semibold leading-tight tracking-tight"
                style={{
                  color: '#565555',
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: 'clamp(1.25rem, 3vw, 32px)',
                  fontWeight: 600,
                  lineHeight: '98.155%',
                  letterSpacing: '-1.28px',
                }}
              >
                SIIF Incubator<br />
                <span>Prototype to Market.</span>
              </h3>
            </div>
          </div>
        </div>

        {/* Rocket + Trail Group */}
        <motion.div
          className="absolute top-[50%] md:top-[44%] left-[10%] md:left-[20%] z-0 pointer-events-none flex items-center"
          initial={{ x: -500, y: 200, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <div className="relative w-[200px] sm:w-[300px] md:w-[450px]">
            {/* Desktop Rocket Trail */}
            <div className="hidden md:block absolute top-[48%] left-[-150%] w-[120vw] h-[500px] z-0 opacity-100 pointer-events-none overflow-visible">              <Image
              src="/assets/image 1.png"
              alt="Rocket Trail Desktop"
              fill
              className="object-contain object-left"
              priority
            />
            </div>

            {/* Mobile Rocket Trail */}
            <div className="block md:hidden absolute top-[100%] left-[-110%] w-[120vw] h-[180px] z-0 opacity-100 pointer-events-none overflow-visible -translate-y-1/2 rotate-[-6deg]">
              <Image
                src="/assets/image 1.png"
                alt="Rocket Trail Mobile"
                fill
                className="object-contain object-left"
                priority
              />
            </div>

            {/* Rocket Visual */}
            <Image
              src="/assets/Rectangle.png"
              alt="SIIF Rocket"
              width={450}
              height={225}
              className="w-full h-auto object-contain drop-shadow-[20px_20px_50px_rgba(0,0,0,0.1)] relative z-20"
              priority
            />
          </div>
        </motion.div>
      </div>

      <div className="mt-auto mb-16 w-full py-6 bg-[#F8F8F8] border-t border-zinc-100">
        <div className="container mx-auto px-4 md:px-6">
          <p
            className="font-semibold text-center md:text-right ml-auto flex-shrink-0"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: 'clamp(0.875rem, 2vw, 24px)',
              lineHeight: '129.909%',
              letterSpacing: '-0.96px',
              color: '#9D9696',
              width: 'auto',
              maxWidth: '100%',
            }}
          >
            Powered by SJCET Palai | Innovation Driven | Founder Focused | Future Ready
          </p>
        </div>
      </div>
    </section>
  );
};