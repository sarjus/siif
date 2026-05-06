"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Lightbulb, Network, Scale, Users } from "lucide-react";

const mentorTracks = [
  {
    title: "Venture Readiness",
    description:
      "Validate problem-solution fit, sharpen positioning, and build a milestone-driven execution plan.",
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    title: "Go-to-Market and Growth",
    description:
      "Design customer acquisition, partnerships, and early revenue experiments suitable for student and early-stage teams.",
    icon: <Scale className="h-5 w-5" />,
  },
  {
    title: "Ecosystem and Funding Connect",
    description:
      "Access curated introductions to founders, industry stakeholders, support programs, and investor networks.",
    icon: <Network className="h-5 w-5" />,
  },
];

const externalMentors = [
  {
    name: "Mr. Ajayan K Anat",
    image: "/assets/Mentors/Mr.%20Ajayan%20K%20Anat.jpeg",
    designation: "Managing Partner",
    organization: "VRDDHI Consulting and Training Services",
    category: "Capital structuring and Fund raising",
    expertise: ["General", "Business Development", "Capital structuring and Fund raising"],
    profileUrl: "https://www.linkedin.com/in/ajayan-k-anat-14163923/",
  },
  {
    name: "Mr. Ajay Basil Varghese",
    image: "/assets/Mentors/ajay-basil-varghese.jpeg",
    designation: "Startup Mentor and Resource Speaker",
    organization: "Innovation and Bootcamp Ecosystem, Kerala",
    category: "Business Development",
    expertise: ["Go to Market", "Business strategy", "Business Development"],
    profileUrl: "https://www.linkedin.com/in/ajay-basil-varghese-042301158/",
  },
];

const mentorFilters = [
  "All",
  "Product/Service design",
  "Go to Market",
  "Business strategy",
  "Capital structuring and Fund raising",
  "Business Development",
  "General",
];

const startupSupport = [
  "One-on-one monthly mentor reviews with action checkpoints",
  "Sector-specific office hours for product, market, and operations",
  "Pitch refinement and investor communication guidance",
  "Founder resilience and leadership conversations for campus teams",
];

export default function MentoringPage() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredMentors = useMemo(() => {
    if (activeFilter === "All") {
      return externalMentors;
    }

    return externalMentors.filter((mentor) => mentor.expertise.includes(activeFilter));
  }, [activeFilter]);

  return (
    <div className="min-h-screen bg-[#FCFCFC]">
      <section className="relative overflow-hidden pt-24 pb-16">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-[#E81116]/10 blur-3xl" />
        <div className="absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-[#700333]/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-[1300px] px-6">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-block pb-2 font-hanken text-[clamp(40px,8vw,92px)] font-black leading-[1.02] tracking-tighter"
            style={{
              background: "linear-gradient(90deg, #700333 0%, #E81116 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Mentoring
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-5 max-w-3xl font-hanken text-lg leading-relaxed text-black/70"
          >
            SIIF connects incubated founders with experienced mentors to de-risk execution,
            accelerate market readiness, and build venture discipline from campus to scale.
          </motion.p>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto max-w-[1300px] px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {mentorTracks.map((track, index) => (
              <motion.article
                key={track.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="group rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E81116]/10 text-[#E81116] transition-transform duration-300 group-hover:scale-105">
                  {track.icon}
                </div>
                <h2 className="font-hanken text-xl font-semibold text-black/90">{track.title}</h2>
                <p className="mt-3 font-hanken text-[15px] leading-relaxed text-black/65">
                  {track.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#EBEFF5] py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(232,17,22,0.08),transparent_40%),radial-gradient(circle_at_10%_90%,rgba(112,3,51,0.08),transparent_45%)]" />

        <div className="relative z-10 mx-auto max-w-[1300px] px-6">
          <div className="mb-10 flex items-center justify-center gap-3 text-center">
            <Users className="h-6 w-6 text-[#E81116]" />
            <h2 className="font-hanken text-4xl font-black text-black/90">Meet Our Mentors</h2>
          </div>

          <div className="mb-12">
            <p className="mb-4 font-hanken text-2xl font-semibold text-black/85">Filter By:</p>
            <div className="flex flex-wrap gap-3">
              {mentorFilters.map((filter) => {
                const active = filter === activeFilter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-full border px-5 py-2.5 font-hanken text-sm font-semibold transition-colors md:text-base ${
                      active
                        ? "border-[#F5A200] bg-[#F5A200] text-white"
                        : "border-[#F5A200] border-dashed bg-transparent text-black/80 hover:bg-[#F5A200]/10"
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-y-14 gap-x-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMentors.map((mentor, index) => (
              <motion.article
                key={mentor.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative flex flex-col items-center rounded-[30px] border border-white/80 bg-white/90 p-6 text-center shadow-[0_16px_35px_rgba(35,35,35,0.08)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_48px_rgba(35,35,35,0.14)]"
              >
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_95%_0%,rgba(232,17,22,0.09),transparent_40%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative h-44 w-44 overflow-hidden rounded-full border-[5px] border-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
                  <Image
                    src={mentor.image}
                    alt={mentor.name}
                    fill
                    sizes="176px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={index === 0}
                  />
                </div>

                <div className="relative mt-6 flex w-full flex-col items-center">
                  <h3 className="mb-3 font-hanken text-2xl font-bold text-black">
                    {mentor.name}
                  </h3>

                  <p className="mt-3 font-hanken text-[16px] font-medium text-[#6F6F6F]">
                    {mentor.category}
                  </p>

                  <Link
                    href={mentor.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#2D7BE7]/30 bg-[#EEF5FF] text-[#2D7BE7] transition-colors hover:bg-[#E3EFFF]"
                    aria-label={`Open ${mentor.name} LinkedIn profile`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-7 w-7"
                      aria-hidden="true"
                    >
                      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.03-1.85-3.03-1.85 0-2.13 1.45-2.13 2.94v5.66H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.38 4.27 5.48v6.26zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77A1.77 1.77 0 0 0 0 1.77v20.46C0 23.2.8 24 1.77 24h20.46A1.77 1.77 0 0 0 24 22.23V1.77A1.77 1.77 0 0 0 22.23 0z" />
                    </svg>
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>

          {filteredMentors.length === 0 ? (
            <p className="mt-10 text-center font-hanken text-lg text-black/65">
              No mentors available for this filter yet.
            </p>
          ) : null}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1300px] px-6">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <h2 className="font-hanken text-3xl font-black text-black/90">How Startups Use Mentoring at SIIF</h2>
            <p className="mt-4 font-hanken text-[15px] leading-relaxed text-black/70">
              Each incubated startup is paired with mentors based on domain fit and stage.
              Sessions are outcome-oriented and aligned to product milestones, customer traction,
              and funding preparedness.
            </p>

            <ul className="mt-6 space-y-3">
              {startupSupport.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#E81116]" />
                  <p className="font-hanken text-[15px] leading-relaxed text-black/75">{point}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
