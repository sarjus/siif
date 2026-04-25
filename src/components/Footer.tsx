"use client";

import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="bg-white pt-20 pb-12 lg:pt-32 lg:pb-16 w-full flex flex-col items-center overflow-hidden">
      <div className="max-w-[1496px] w-full px-6 flex flex-col gap-10 lg:gap-24">
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-start items-start gap-4 lg:gap-0">

          {/* Logo & Tagline */}
          <div className="flex flex-col w-full lg:w-auto">
            <h2 className="text-[clamp(80px,12vw,170px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken">
              SIIF.
            </h2>
            <p className="text-[clamp(20px,3vw,36px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken max-w-[400px]">
              From Idea to Impact. Built inside SJCET Palai.
            </p>
          </div>

          {/* Contact Card */}
          <div className="w-full lg:w-[347px] p-6 lg:p-[22px_43px] rounded-[20px] lg:rounded-[25px] border-[#DCDCDC] border bg-[#F9F9F9] flex flex-col gap-3 lg:gap-[9px] self-stretch lg:self-start lg:mr-32 lg:ml-24 mt-4 lg:mt-0">
            <span className="text-[clamp(16px,1.5vw,20px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken">
              Contact Us
            </span>
            <Link
              href="mailto:ceosiif@sjcetpalai.ac.in"
              className="text-[clamp(14px,1.5vw,20px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#C41E3A] font-hanken underline decoration-[#C41E3A] underline-offset-4 whitespace-nowrap"
            >
              ceosiif@sjcetpalai.ac.in
            </Link>
            <span className="text-[clamp(16px,1.5vw,20px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken">
              Ph: +91 9447233663
            </span>
            <span className="text-[clamp(14px,1.2vw,18px)] font-semibold leading-[1.4] tracking-[-0.04em] text-[#565555] font-hanken">
              St.Joseph's College of Engineering & Technology Palai, Choondacherry PO, Meenachil Taluk, Kottayam, Kerala, India, 686579
            </span>
          </div>

          {/* Navigation Grid */}
          <div className="grid w-full lg:w-[622px] grid-cols-2 gap-x-4 sm:gap-x-8 lg:gap-x-[75px] gap-y-6 lg:gap-y-[32px] lg:ml-auto mt-6 lg:mt-0">
            <div className="flex flex-col gap-4 lg:gap-[32px]">
              <Link href="/" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Home
              </Link>
              <Link href="/about-siif" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                About
              </Link>
              <Link href="/incubation-program" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Incubation
              </Link>
              <Link href="/programs" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Programs
              </Link>
            </div>
            <div className="flex flex-col gap-4 lg:gap-[32px]">
              <Link href="/schemes" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Schemes
              </Link>
              <Link href="/gallery" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Gallery
              </Link>
              <Link href="/careers" className="text-[clamp(18px,2.5vw,24px)] font-semibold leading-[115.967%] tracking-[-0.04em] text-[#565555] font-hanken hover:opacity-70 transition-opacity whitespace-nowrap">
                Careers
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="w-full flex justify-center lg:mt-12 overflow-hidden px-4">
          <h1 className="w-full text-center text-[clamp(28px,8.5vw,175.616px)] font-[900] leading-[1.0] tracking-[-0.04em] font-hanken bg-gradient-to-b from-[#EBEBEB] to-transparent bg-clip-text text-transparent select-none whitespace-nowrap">
            START SOMETHING
          </h1>
        </div>
      </div>
    </footer>
  );
};