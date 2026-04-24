"use client";

import { motion } from "framer-motion";

const stats = [
  { label: "Seats", value: "50+" },
  { label: "5 Seater Cabins", value: "5" },
  { label: "Uninterrupted Power Supply", value: "24 Hrs" },
  { label: "Mentors & Experts", value: "50+" },
];

export const Stats = () => {
  return (
    <section className="py-32 bg-white relative overflow-hidden border-y border-zinc-100">
      {/* Subtle decorative background element */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
      
      <div className="container mx-auto px-4 md:px-6">
        {/* Intro Text Block */}
        <div className="max-w-[800px] mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-zinc-900 mb-8 leading-[1.1] uppercase tracking-tighter"
          >
            Empowering <span className="text-primary italic">Innovation</span> at SIIF. <br />
            We turn bold ideas into market leaders.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-zinc-600 leading-relaxed"
          >
            Our ecosystem is designed to support founders at every stage of their journey. 
            From initial concept to scaling and global expansion, SIIF provides the critical 
            infrastructure and network needed for exponential growth.
          </motion.p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col space-y-2 p-8 rounded-3xl border border-zinc-100 bg-zinc-50/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300"
            >
              <div className="text-5xl md:text-6xl font-black text-primary tracking-tighter">
                {stat.value}
              </div>
              <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
