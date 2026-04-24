"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

const ComingSoon = ({ title, description }: ComingSoonProps) => {
  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden bg-white px-6 py-20">
      {/* Hexagonal Grid Background */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' fill='none' viewBox='0 0 56 100'%3E%3Cpath stroke='%23000' stroke-width='0.5' d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66'/%3E%3Cpath stroke='%23000' stroke-width='0.5' d='M28 100L0 84L0 50L28 34L56 50L56 84L28 100'/%3E%3C/svg%3E")`,
          backgroundSize: '80px 140px',
          backgroundPosition: 'center',
        }}
      />

      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ x: [0, 10, 0], y: [0, -10, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] left-[10%] w-32 h-32 bg-gray-200 rounded-2xl rotate-12 blur-3xl" 
        />
        <motion.div 
          animate={{ x: [0, -15, 0], y: [0, 15, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[20%] right-[10%] w-40 h-40 bg-primary/10 rounded-full blur-3xl" 
        />
        
        {/* Smaller floating shapes like in reference */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              y: [0, Math.random() * 20 - 10, 0],
              x: [0, Math.random() * 20 - 10, 0]
            }}
            transition={{ 
              duration: 3 + Math.random() * 4, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: Math.random() * 2
            }}
            className={`absolute w-${2 + (i % 3)} h-${2 + (i % 3)} bg-gray-300/30 rounded-sm`}
            style={{
              top: `${15 + Math.random() * 70}%`,
              left: `${10 + Math.random() * 80}%`,
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
        {/* Icon Group - Matching reference image */}
        <div className="flex items-center gap-1.5 mb-10 translate-y-[-10px]">
            <div className="w-5 h-5 bg-[#E81116] rounded-[3px]" />
            <div className="w-5 h-5 bg-[#1A1A1A] rounded-[3px]" />
            <div className="w-5 h-5 bg-[#F9F1EB] rounded-[3px]" />
            <div className="w-5 h-5 bg-[#700333] rounded-[3px]" />
            <div className="w-5 h-5 bg-[#E81116] rounded-[3px]" />
            <div className="w-9 h-9 ml-1.5 bg-[#E81116] rounded-[4px]" />
        </div>

        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="px-4 py-1.5 bg-red-50 border border-red-200 rounded-lg mb-8"
        >
          <span className="text-[11px] font-black tracking-[0.2em] text-[#E81116] uppercase font-hanken">
            Coming Soon
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-4xl md:text-6xl font-[950] text-black mb-8 tracking-[-0.04em] font-hanken"
        >
          {title}
        </motion.h1>

        {/* Description */}
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="text-[17px] md:text-[19px] text-[#555] mb-14 leading-[1.6] max-w-2xl px-4 font-hanken font-medium"
        >
          {description}
        </motion.p>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <Link 
            href="/" 
            className="group flex items-center gap-2.5 text-[#E81116] font-extrabold text-[15px] hover:gap-3.5 transition-all duration-300 font-hanken"
          >
            <ArrowLeft strokeWidth={3} className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="border-b-2 border-transparent group-hover:border-[#E81116] pb-0.5 transition-all">Back to Home</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoon;
