"use client";

import { motion } from "framer-motion";
import {
  Rocket,
  GraduationCap,
  Users,
  Handshake,
  Target,
  CheckCircle
} from "lucide-react";

const redColor = "#E81116";

const coreObjectives = [
  "Establishing and managing incubation and acceleration programs",
  "Supporting startups through mentorship, infrastructure, and technical assistance",
  "Enabling intellectual property development and commercialization",
  "Facilitating industry, academic, and government collaboration",
  "Promoting research, innovation, and entrepreneurship culture"
];

const centreOfferings = [
  {
    icon: <CheckCircle className="w-6 h-6" style={{ color: redColor }} />,
    title: "Idea validation and startup mentoring"
  },
  {
    icon: <CheckCircle className="w-6 h-6" style={{ color: redColor }} />,
    title: "Workspace and infrastructure support"
  },
  {
    icon: <CheckCircle className="w-6 h-6" style={{ color: redColor }} />,
    title: "Technical and product development guidance"
  },
  {
    icon: <CheckCircle className="w-6 h-6" style={{ color: redColor }} />,
    title: "Business model development and market access"
  },
  {
    icon: <CheckCircle className="w-6 h-6" style={{ color: redColor }} />,
    title: "Funding facilitation and investor connect"
  }
];

const keyActivities = [
  "Conducts startup bootcamps, workshops, and training programs",
  "Provides incubation and pre-incubation support",
  "Facilitates prototyping, testing, and product development",
  "Connects startups with funding agencies and investors",
  "Encourages interdisciplinary and socially relevant innovations"
];

export default function AboutSIIF() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 z-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
            backgroundSize: '30px 30px'
          }}>
        </div>

        {/* Decorative Blocks (matching screenshot) */}
        <div className="absolute right-10 top-20 hidden lg:grid grid-cols-4 gap-1 z-0">
          {[...Array(16)].map((_, i) => (
            <div key={i} className={`w-8 h-8 rounded-sm ${i === 5 ? 'bg-primary' :
              i === 9 ? 'bg-primary/80' :
                i === 10 ? 'bg-black' :
                  i === 11 ? 'bg-primary/20' :
                    i === 12 ? 'bg-primary/60' :
                      'bg-gray-50'
              }`} />
          ))}
        </div>

        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <h1 className="text-[clamp(40px,8vw,100px)] font-black leading-[0.9] tracking-tighter mb-4 font-hanken" style={{
              background: 'linear-gradient(90deg, #700333 0%, #E81116 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              About SIIF
            </h1>
            <p className="text-[clamp(18px,2vw,24px)] font-semibold text-black/60 font-hanken mb-12">
              SJCET Innovation and Incubation Foundation
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="space-y-6 text-lg leading-relaxed text-black/80 font-hanken lg:text-justify"
              >
                <p>
                  The <span className="font-bold text-black font-hanken">SJCET Innovation and Incubation Foundation (SIIF)</span> is a Section 8 company established under the Companies Act, 2013, with its registered office in Kerala. SIIF serves as the official innovation and startup incubation arm of St. Joseph&apos;s College of Engineering and Technology (SJCET), Palai, fostering entrepreneurship within the campus and beyond.
                </p>
              </motion.div>

              {/* SIIF Incubation Center Section */}
              <div className="pt-12">
                <h2 className="text-3xl font-black mb-6 font-hanken flex items-center gap-3" style={{ color: redColor }}>
                  SIIF Incubation Center
                  <div className="h-px flex-grow bg-black/5 ml-4"></div>
                </h2>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6 text-lg leading-relaxed text-black/80 font-hanken lg:text-justify"
                >
                  <p>
                    At the core of SIIF is its dedicated Incubation Center, designed to support the transformation of innovative ideas into successful startups. The center provides a structured ecosystem where students, faculty, alumni, and external innovators can develop, validate, and scale their ventures.
                  </p>
                  <p className="font-semibold text-black/90 pt-4">The SIIF Incubation Center offers:</p>
                </motion.div>
              </div>

              {/* Centre Offerings */}
              <div className="grid md:grid-cols-2 gap-4 mt-6 mb-12">
                {centreOfferings.map((offering, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-1">{offering.icon}</div>
                    <p className="text-base text-black/80 font-hanken">{offering.title}</p>
                  </motion.div>
                ))}
              </div>

              {/* Vision and Purpose Section */}
              <div className="pt-12">
                <h2 className="text-3xl font-black mb-6 font-hanken flex items-center gap-3" style={{ color: redColor }}>
                  Vision and Purpose
                  <div className="h-px flex-grow bg-black/5 ml-4"></div>
                </h2>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6 text-lg leading-relaxed text-black/80 font-hanken lg:text-justify"
                >
                  <p>
                    SIIF aims to act as a catalyst for innovation and entrepreneurship by building a vibrant incubation ecosystem. It strives to position SJCET as a leading hub for startup creation, promoting sustainable, inclusive, and socially impactful ventures.
                  </p>
                </motion.div>
              </div>

              {/* Core Objectives Section */}
              <div className="pt-12">
                <h2 className="text-3xl font-black mb-8 font-hanken flex items-center gap-3" style={{ color: redColor }}>
                  Core Objectives
                  <div className="h-px flex-grow bg-black/5 ml-4"></div>
                </h2>
                <p className="text-lg text-black/80 font-hanken mb-6 lg:text-justify">As defined in its MoA, SIIF focuses on:</p>
                <ul className="space-y-4">
                  {coreObjectives.map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className="flex items-start gap-3 group"
                    >
                      <div className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: redColor }}></div>
                      <p className="text-lg font-medium text-black/80 font-hanken leading-snug">
                        {item}
                      </p>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Activities Section */}
      <section className="py-20 bg-gray-50/50">
        <div className="max-w-[1400px] mx-auto px-6">
          <h2 className="text-3xl font-black mb-8 font-hanken flex items-center gap-3" style={{ color: redColor }}>
            Key Activities of the Incubation Center
            <div className="h-px flex-grow bg-black/5 ml-4"></div>
          </h2>

          <ul className="space-y-4">
            {keyActivities.map((activity, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-start gap-3 group"
              >
                <div className="w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: redColor }}></div>
                <p className="text-lg font-medium text-black/80 font-hanken leading-snug">
                  {activity}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Our Vision Section */}
      <section className="py-20 mb-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative bg-[#F9F9F9] p-10 lg:p-16 rounded-[25px] overflow-hidden border border-black/5"
          >
            <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: redColor }}></div>
            <div className="max-w-4xl relative z-10">
              <h2 className="text-4xl font-black mb-8 text-black font-hanken" style={{ color: redColor }}>Our Vision</h2>
              <p className="text-2xl font-semibold leading-relaxed text-black/70 font-hanken lg:text-justify">
                SIIF aims to act as a catalyst for innovation and entrepreneurship by building a vibrant incubation ecosystem. It strives to position SJCET as a leading hub for startup creation, promoting sustainable, inclusive, and socially impactful ventures.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
