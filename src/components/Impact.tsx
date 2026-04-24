"use client";

import React from "react";
import { motion } from "framer-motion";

export const Impact = () => {
  return (
    <section className="w-full bg-white pt-4 pb-12 md:pt-12 md:pb-24 overflow-hidden">

      <div className="flex items-center justify-center gap-4 md:gap-11 mb-8 md:mb-16 px-4">

        <div className="hidden md:block w-full max-w-[475px] h-[3px] bg-black/15" />

        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-11 shrink-0">
          <h2 className="text-[#565555] font-hanken font-semibold text-[32px] md:text-[48px] leading-[87.145%] tracking-[-1.92px] text-center">
            Built For
          </h2>

          <button className="flex items-center justify-center gap-[10px] px-6 md:px-[43px] py-4 md:py-[26px] bg-[#F4F4F4] border border-[#5C050B] rounded-[55px] text-[#565555] font-hanken font-semibold text-[32px] md:text-[48px] leading-[87.145%] tracking-[-1.92px] transition-all hover:bg-[#e8e8e8] group">
            First-time founders
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 md:w-10 md:h-10 transform transition-transform group-hover:translate-y-1"
            >
              <path d="M10 15L20 25L30 15" stroke="#1E1E1E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>


        <div className="hidden md:block w-full max-w-[475px] h-[3px] bg-black/15" />
      </div>

      <div className="container mx-auto px-4 max-w-[1636px]">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-12 lg:gap-20">
          <div className="flex flex-col gap-4 md:gap-6 max-w-full lg:max-w-[848px]">
            <div className="flex flex-col gap-2">
              <h2 className="text-[#565555] font-hanken font-semibold text-[44px] md:text-[64px] leading-[87.145%] tracking-[-2.56px]">
                Our Impact
              </h2>
              <p className="text-[#848484] font-hanken font-semibold text-[24px] md:text-[32px] leading-[87.145%] tracking-[-1.28px]">
                Proof over promises.
              </p>
            </div>

            <p className="text-[#989898] font-hanken font-medium text-[20px] md:text-[32px] leading-[115.967%] tracking-[-1.28px]">
              More than 50 startups have walked through these doors. They&apos;ve raised funding, landed customers, and built teams. Some are still early. Some are scaling fast. All of them started exactly where you are now.
            </p>
          </div>

          <div className="relative w-full lg:w-auto flex flex-col items-center lg:items-end gap-12 lg:gap-4 mt-12 lg:mt-0 lg:pr-10">

            <motion.div
              initial={{ opacity: 0, rotate: 0 }}
              whileInView={{ opacity: 1, rotate: 12.507 }}
              viewport={{ once: true }}
              className="flex flex-col items-center lg:items-start text-[#DEDEDE] font-hanken font-extrabold origin-center"
              style={{ transform: 'rotate(12.507deg)' }}
            >
              <span className="text-[70px] md:text-[91.741px] leading-[115.967%] tracking-[-3.67px]">
                100+
              </span>
              <span className="text-[20px] md:text-[25.802px] leading-[115.967%] tracking-[-1.032px] mt-[-10px] md:mt-[-15px]">
                Industry Partners
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, rotate: 0 }}
              whileInView={{ opacity: 1, rotate: -9.795 }}
              viewport={{ once: true }}
              className="flex flex-col items-center lg:items-start text-[#DEDEDE] font-hanken font-extrabold origin-center lg:mt-10 lg:mr-[-40px]"
              style={{ transform: 'rotate(-9.795deg)' }}
            >
              <span className="text-[90px] md:text-[128px] leading-[115.967%] tracking-[-5.12px]">
                50+
              </span>
              <span className="text-[26px] md:text-[36px] leading-[115.967%] tracking-[-1.44px] mt-[-15px] md:mt-[-25px]">
                Startups incubated
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Impact;
