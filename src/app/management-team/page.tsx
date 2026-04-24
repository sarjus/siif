"use client";

import Image from "next/image";
import { motion } from "framer-motion";

const managementTeam = [
  {
    name: "Msgr. Dr. Joseph Thadathil",
    role: "Director, SIIF",
    position: "Chairman, SJCET Palai",
    image: "/assets/Joseph Thadathil.jpg",
    order: 1
  },
  {
    name: "Rev. Prof. James John Mangalathu",
    role: "Director, SIIF",
    position: "Director, SJCET Palai",
    image: "/assets/James John Mangalathu.jpg",
    order: 2
  },
  {
    name: "Dr. V. P. Devassia, Ph.D.",
    role: "Director, SIIF",
    position: "Principal, SJCET Palai",
    image: "/assets/VP Devsaaia.jpg",
    order: 3
  }
];

const ceoTeam = [
  {
    name: "Mr. Sarju S",
    role: "CEO, SIIF",
    position: "Chief Executive Officer",
    image: "/assets/Sarju S.jpeg",
    linkedin: "https://www.linkedin.com/in/sarju-s/"
  }
];

const redColor = "#E81116";

export default function ManagementTeamPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        {/* Grid Background */}
        <div
          className="absolute inset-0 z-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
            backgroundSize: "30px 30px"
          }}
        />

        {/* Decorative Blocks */}
        <div className="absolute right-10 top-20 hidden lg:grid grid-cols-4 gap-1 z-0">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-sm ${
                i === 5
                  ? "bg-red-600"
                  : i === 9
                    ? "bg-red-400"
                    : i === 10
                      ? "bg-black"
                      : i === 11
                        ? "bg-red-200"
                        : i === 12
                          ? "bg-red-500"
                          : "bg-gray-50"
              }`}
            />
          ))}
        </div>

        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <h1
              className="text-[clamp(40px,8vw,100px)] font-black leading-[0.9] tracking-tighter mb-4 font-hanken"
              style={{
                background: "linear-gradient(90deg, #700333 0%, #E81116 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}
            >
              Leadership Team
            </h1>
            <p className="text-[clamp(18px,2vw,24px)] font-semibold text-black/60 font-hanken">
              Meet the visionaries driving SIIF forward
            </p>
          </motion.div>
        </div>
      </section>

      {/* Management Team Section */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {managementTeam.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className="group"
              >
                {/* Card Container */}
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
                  {/* Image Container */}
                  <div className="relative overflow-hidden bg-gray-100 h-[450px]">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                      }}
                    />
                  </div>

                  {/* Content Section */}
                  <div className="p-8 flex flex-col justify-center">
                    <h3 className="text-2xl font-bold font-hanken text-black mb-3">
                      {member.name}
                    </h3>

                    <p className="text-base font-semibold font-hanken mb-2" style={{ color: redColor }}>
                      {member.role}
                    </p>
                    
                    <p className="text-base text-gray-500 font-hanken">
                      {member.position}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CEO Section */}
      <section className="py-20 bg-gray-50/50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-12">
            <h2
              className="text-3xl font-black mb-2 font-hanken"
              style={{ color: redColor }}
            >
              Chief Executive Officer
            </h2>
            <div className="h-1 w-32 rounded-full" style={{ backgroundColor: redColor }}></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-1 gap-8 max-w-2xl">
            {ceoTeam.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="group"
              >
                {/* Card Container */}
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
                  {/* Image Container */}
                  <div className="relative overflow-hidden bg-gray-100 h-[450px]">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                      }}
                    />
                  </div>

                  {/* Content Section */}
                  <div className="p-8 flex flex-col justify-center">
                    <h3 className="text-2xl font-bold font-hanken text-black mb-3">
                      {member.name}
                    </h3>

                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-base font-semibold font-hanken" style={{ color: redColor }}>
                        {member.role}
                      </p>
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                          title="Visit LinkedIn"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            style={{ color: "#0A66C2" }}
                          >
                            <path d="M20.446 20.454h-3.554v-5.569c0-1.328-.475-2.236-1.986-2.236-1.084 0-1.722.722-2.004 1.418-.103.25-.129.599-.129.948v5.439h-3.554s.05-8.746 0-9.637h3.554v1.365c.427-.659 1.189-1.599 2.898-1.599 2.114 0 3.696 1.381 3.696 4.352v5.519zM5.337 8.855c-1.144 0-1.915-.758-1.915-1.707 0-.955.771-1.707 1.96-1.707 1.188 0 1.915.75 1.94 1.707 0 .949-.752 1.707-1.985 1.707zm1.946 11.599H3.392V9.672h3.891v10.782zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
