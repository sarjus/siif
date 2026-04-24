"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const stages = [
  {
    id: "01",
    title: "Spark",
    description: "You notice what others ignore. We help you turn a nagging problem into a startup thesis worth betting on.",
    alignment: "right"
  },
  {
    id: "02",
    title: "Prototype",
    description: "You prove it before you build it. Validate users, sketch the model, ship a working first version.",
    alignment: "left"
  },
  {
    id: "03",
    title: "Launch",
    description: "You meet the market head-on. A launch playbook, real customer introductions, and mentors who've done it before",
    alignment: "right"
  },
  {
    id: "04",
    title: "Scale",
    description: "You build something that lasts. Capital, team, and a network that opens doors. You grow beyond the campus. SIIF stays in your corner.",
    alignment: "left"
  }
];

export const FounderJourney = () => {
  return (
    <section className="relative pt-16 pb-8 lg:pt-32 lg:pb-12 overflow-hidden bg-white font-[family-name:var(--font-hanken-grotesk)]">

      <div className="absolute left-[20px] top-[40%] z-10 hidden lg:block">
        <motion.div
          initial={{ opacity: 0, rotate: 0 }}
          whileInView={{ opacity: 1, rotate: 16.561 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative w-[360px] h-[360px]"
        >
          <Image
            src="/assets/Rectangle(3).png"
            alt="Left decoration"
            fill
            className="object-contain"
          />
        </motion.div>
      </div>

      <div className="absolute right-[-100px] top-[10%] z-10 hidden lg:block">
        <motion.div
          initial={{ opacity: 0, rotate: 0 }}
          whileInView={{ opacity: 1, rotate: -13.383 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative w-[515px] h-[515px]"
        >
          <Image
            src="/assets/Rectangle(2).png"
            alt="Right decoration"
            fill
            className="object-contain"
          />
        </motion.div>
      </div>

      <div className="container mx-auto px-4 relative z-20">

        <div className="flex flex-col lg:flex-row lg:items-center mb-12 lg:mb-24 max-w-[1300px] mx-auto">
          <div className="flex flex-col">
            <h3 className="text-[#848484] text-[24px] lg:text-[38.658px] font-semibold leading-[87.145%] tracking-[-1.546px] mb-2 lg:mb-0">
              Founder Journey
            </h3>
            <h2 className="text-[36px] md:text-[50px] lg:text-[68.726px] font-semibold leading-[1.1] lg:leading-[87.145%] tracking-[-1.546px] lg:tracking-[-2.749px] bg-gradient-to-b from-[#F12837] to-[#8F1D5D] bg-clip-text text-fill-transparent text-transparent">
              From first spark <br className="hidden lg:block" /> to funded startup
            </h2>
          </div>
          <div className="hidden lg:block flex-1 h-[1px] bg-black/40 ml-8" />
        </div>

        <div className="flex flex-col gap-4 lg:gap-4 max-w-[1300px] mx-auto mt-12 lg:mt-20">

          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-4 lg:ml-[-40px]">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="w-full lg:max-w-[608px]"
            >
              <StageBox stage={stages[0]} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full lg:max-w-[608px] lg:mt-16 lg:ml-[-10px]"
            >
              <StageBox stage={stages[1]} />
            </motion.div>
          </div>

          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-4 lg:ml-[60px] lg:-mt-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="w-full lg:max-w-[608px]"
            >
              <StageBox stage={stages[2]} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="w-full lg:max-w-[608px] lg:mt-12 lg:ml-[-20px]"
            >
              <StageBox stage={stages[3]} />
            </motion.div>
          </div>
        </div>

        <div className="relative mt-8 mb-8 lg:mt-0 lg:mb-0">
          <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-end gap-x-8 pr-12 lg:pr-24">
            <div className="relative w-full max-w-[1142px] opacity-20 lg:opacity-40 translate-x-12 lg:translate-x-0">
              <svg width="100%" height="auto" viewBox="0 0 1142 103" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
                <path
                  d="M-211 0.452148C-95.4222 54.9206 -243.19 5.35069 77 85.4521C202.5 116.848 364.384 102.848 705.5 48.9519C939.084 12.046 1084 69.5583 1141 83.9521"
                  stroke="black"
                  strokeDasharray="20 20"
                />
              </svg>
            </div>
            <div className="mt-2 lg:mt-0 lg:absolute lg:right-[15%] lg:bottom-[-5px] text-center lg:text-left">
              <p className="text-[#515151] text-[24px] md:text-[30px] lg:text-[36px] font-medium leading-[1.2] lg:leading-[87.145%] tracking-[-1px] lg:tracking-[-1.44px] max-w-[294px]">
                Five stages. <br className="hidden lg:block" /> One destination.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const StageBox = ({ stage }: { stage: typeof stages[0] }) => (
  <div
    className="relative w-full h-[220px] md:h-[261px] rounded-[30px] lg:rounded-[60px] border-[10px] lg:border-[20px] border-white bg-[#F8F8F8] p-6 md:p-10 lg:p-12 flex flex-col justify-center overflow-hidden"
    style={{
      boxShadow: "-2px 1px 70.8px 0 rgba(0, 0, 0, 0.05) inset"
    }}
  >
    <div className={`flex items-baseline justify-between mb-2 md:mb-4 lg:mb-2 ${stage.alignment === "right" ? "flex-row-reverse" : "flex-row"}`}>
      <h4 className="text-[#565555] text-[36px] md:text-[48px] lg:text-[65px] font-semibold leading-none tracking-[-1.5px] lg:tracking-[-2.6px]">
        {stage.title}
      </h4>
      <span className="text-[#DBDBDB] text-[48px] md:text-[64px] lg:text-[84px] font-extrabold leading-none tracking-[-2px] lg:tracking-[-3.356px] select-none">
        {stage.id}
      </span>
    </div>

    <div className={`relative z-10 flex flex-col ${stage.alignment === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <p className="text-[#565555]/40 text-[16px] md:text-[20px] lg:text-[24px] font-medium leading-[1.3] lg:leading-[1.2] tracking-[-0.5px] lg:tracking-[-0.96px] max-w-[280px] md:max-w-none lg:max-w-[400px]">
        {stage.description}
      </p>
    </div>
  </div>
);
