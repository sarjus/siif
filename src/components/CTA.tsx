"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const CTA = () => {
  return (
    <section 
      className="relative w-full overflow-hidden bg-cover bg-center py-20"
      style={{
        backgroundImage: `url('/assets/Frame 28.png')`,
      }}
    >
      <div className="container mx-auto px-4 flex justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center justify-center gap-[24px] bg-[#FFF] rounded-[32px] md:rounded-[54px] w-full max-w-[1636px] px-6 md:px-[11px] py-12 md:pt-[44px] md:pb-[47px]"
        >
          <div className="flex flex-col items-center gap-4 text-center max-w-[1073px] w-full">
            <h2 
              className="text-[#565555] font-hanken font-semibold text-[28px] sm:text-[36px] md:text-[64px] leading-[1.2] md:leading-[115.967%] tracking-[-1px] md:tracking-[-2.56px]"
            >
              The worst startup decision is waiting.
            </h2>
            <p 
              className="text-[#878787] font-hanken font-medium text-[16px] sm:text-[20px] md:text-[32px] leading-[1.4] md:leading-[115.967%] tracking-[-0.5px] md:tracking-[-1.28px]"
            >
              Join SIIF and transform your innovative idea into a thriving startup. We provide the mentoring, resources, and network you need.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-[10px] mt-4 md:mt-2 w-full sm:w-auto">
            <Link href="/apply-incubation">
              <Button 
                className="w-full sm:w-auto h-auto px-6 md:px-[30px] py-[10px] md:py-[14px] rounded-full text-white font-hanken font-semibold text-[14px] sm:text-[18px] md:text-[24px] leading-tight md:leading-[98.155%] tracking-[-0.5px] md:tracking-[-1.28px] border-none shadow-md transition-all duration-300 hover:scale-105 hover:brightness-110 hover:shadow-lg active:scale-95"
                style={{
                  background: "radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), #E81116",
                }}
              >
                Start your journey
              </Button>
            </Link>
            <Button 
              variant="outline"
              className="w-full sm:w-auto h-auto px-6 md:px-[30px] py-[10px] md:py-[14px] rounded-full text-[#070707] font-hanken font-semibold text-[14px] sm:text-[18px] md:text-[24px] leading-tight md:leading-[98.155%] tracking-[-0.5px] md:tracking-[-1.28px] border-none shadow-sm transition-all duration-300 hover:scale-105 hover:brightness-105 hover:shadow-md active:scale-95"
              style={{
                background: "radial-gradient(76.17% 53.63% at 47.52% 111.03%, rgba(182, 182, 182, 0.37) 0%, rgba(102, 102, 102, 0.00) 100%), rgba(213, 213, 213, 0.49)",
              }}
            >
              See Our Programs
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
