'use client';

import { useState } from 'react';

interface Company {
  id: string;
  name: string;
  logo: string;
  tagline: string;
  description: string;
  domains: string[];
  location: string;
  focus: string;
}

interface CompanyWithWebsite extends Company {
  website?: string;
}

const companies: CompanyWithWebsite[] = [
  {
    id: 'procis',
    name: 'Procis Brainlabs Pvt Ltd',
    logo: '/assets/Startups/Procis Brainlabs.png',
    tagline: 'Transforming Education Through Experiential Learning',
    description:
      'Procis is a Kerala-based edtech startup revolutionizing education through hands-on, technology-driven learning solutions. They empower students, educators, and institutions with future-ready skills through interactive learning experiences that bridge the gap between traditional academics and real-world application.',
    domains: [
      'STEM Education',
      'Robotics',
      'Artificial Intelligence',
      'IoT',
      'Coding',
      'Research & Innovation',
      'Skill Development',
    ],
    location: 'Kerala',
    focus: 'Experiential & Technology-Driven Learning',
    website: 'https://www.procis.in/',
  },
  {
    id: 'kochi-digital',
    name: 'Kochi Digital',
    logo: '/assets/Startups/Kochi Digital.png',
    tagline: 'Innovative Digital Transformation & IT Solutions',
    description:
      'Kochi Digital is a Kerala-based technology startup delivering innovative digital transformation and IT solutions for businesses and institutions. They empower organizations with customized digital products, scalable technology solutions, enhanced operational efficiency, robust security, and sustainable business growth.',
    domains: [
      'Software Development',
      'Web Development',
      'Cloud Hosting',
      'Cybersecurity',
      'Digital Marketing',
      'IT Infrastructure',
      'Process Automation',
      'AI-Enabled Solutions',
      'Enterprise Management',
    ],
    location: 'Kerala',
    focus: 'Digital Transformation & Enterprise Solutions',
    website: 'https://kochi.digital/',
  },
  {
    id: 'vedik-solutions',
    name: 'Vedik Solutions',
    logo: '/assets/Startups/Vedik logo.jpeg',
    tagline: 'Bridging Ideas and Digital Transformation',
    description:
      'Vedik Solutions is an emerging IT startup dedicated to creating innovative, technology-driven software solutions for businesses, educational institutions, and individuals. Specializing in custom software development, web and mobile applications, cloud-based solutions, and business automation, Vedik Solutions helps organizations streamline operations, enhance productivity, and accelerate growth through impactful digital transformation.',
    domains: [
      'Custom Software Development',
      'Web Development',
      'Mobile Applications',
      'Cloud Solutions',
      'Business Automation',
      'Digital Transformation',
    ],
    location: 'Kerala',
    focus: 'Custom Software & Digital Innovation',
  },
  {
    id: 'geocon-india',
    name: 'GEOCON INDIA',
    logo: '/assets/Startups/GEOCON-logo.png',
    tagline: 'Advanced DC Power Systems for Critical Infrastructure',
    description:
      'GEOCON INDIA is a technology-driven company delivering advanced DC power systems and solutions for SCADA communication networks, electric substation protection, and industrial infrastructure. In collaboration with a leading Spanish technology partner, GEOCON introduces cutting-edge products to the Indian market, serving over 40 power utilities with plans to expand across Asia and the Middle East.',
    domains: [
      'DC Power Systems',
      'SCADA Communication',
      'Substation Protection',
      'Industrial Infrastructure',
      'Power Utilities',
      'Energy Technology',
    ],
    location: 'Kerala',
    focus: 'Power Systems & Energy Infrastructure',
  },
];

export default function CurrentCompaniesPage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-white" style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}>
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-b from-[#F5F6F7] to-white flex justify-center px-4 py-16 md:py-24">
        <div className="max-w-[1000px] w-full flex flex-col items-center text-center">
          <p className="text-base md:text-[18px] font-medium text-[#9A9A9A] mb-4 tracking-wide">
            Our Portfolio
          </p>
          <h1 className="text-[28px] md:text-[40px] lg:text-[48px] font-semibold leading-[1.3] tracking-tight text-[#4A4A4A] mb-6">
            Current Companies
          </h1>
          <p className="text-base md:text-lg text-[#666666] max-w-[700px] leading-relaxed">
            Meet the innovative startups currently being incubated and accelerated through SIIF. These companies are
            building the future with cutting-edge solutions and bold ideas.
          </p>
        </div>
      </section>

      {/* Companies Grid */}
      <section className="w-full bg-[#F5F6F7] flex justify-center px-4 py-12 md:py-20">
        <div className="max-w-[1200px] w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {companies.map((company) => (
              <div
                key={company.id}
                className="group cursor-pointer"
                onMouseEnter={() => setHoveredId(company.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Card */}
                <div
                  className="h-full bg-white rounded-[24px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] 
                    transition-all duration-300 ease-out hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] 
                    hover:-translate-y-2 border border-[#F0F0F0] hover:border-[#FF3B3B]/20 flex flex-col"
                >
                  {/* Logo Container */}
                  <div className="w-full h-[180px] md:h-[220px] bg-white rounded-[16px] flex items-center justify-center mb-6 overflow-hidden border border-[#E5E5E5] group-hover:border-[#FF3B3B]/30 transition-colors duration-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]">
                    <img
                      src={company.logo}
                      alt={company.name}
                      className="max-w-[85%] max-h-[85%] object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-125"
                    />
                  </div>

                  {/* Company Info */}
                  <h2 className="text-[24px] md:text-[28px] font-semibold text-[#4A4A4A] mb-2">{company.name}</h2>
                  <p className="text-[13px] md:text-[14px] font-medium text-[#FF3B3B] tracking-wide mb-4 uppercase">
                    {company.focus}
                  </p>

                  <p className="text-[15px] md:text-[16px] text-[#666666] leading-relaxed mb-6 flex-grow">
                    {company.description}
                  </p>

                  {/* Location Badge */}
                  <div className="mb-6 flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Location:</span>
                    <span className="inline-flex px-3 py-1 bg-[#FFF0F0] text-[#FF3B3B] text-[13px] font-medium rounded-full">
                      {company.location}
                    </span>
                  </div>

                  {/* Domains */}
                  <div className="border-t border-[#E5E5E5] pt-6">
                    <p className="text-[12px] font-semibold text-[#9A9A9A] uppercase tracking-wide mb-4">Key Domains</p>
                    <div className="flex flex-wrap gap-2">
                      {company.domains.map((domain, index) => (
                        <span
                          key={index}
                          className={`text-[12px] md:text-[13px] font-medium px-3 py-2 rounded-full transition-all duration-300 ${
                            hoveredId === company.id
                              ? 'bg-[#FF3B3B] text-white shadow-[0_4px_12px_rgba(255,59,59,0.3)]'
                              : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#FFF0F0] hover:text-[#FF3B3B]'
                          }`}
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-8 w-full py-3 px-4 bg-gradient-to-r from-[#FF3B3B] to-[#E82E2E] text-white font-semibold rounded-[12px] 
                        transition-all duration-300 hover:shadow-[0_8px_20px_rgba(255,59,59,0.4)] hover:scale-105 
                        active:scale-95 text-[14px] md:text-[15px] inline-flex items-center justify-center"
                    >
                      Visit Website
                    </a>
                  ) : (
                    <div className="mt-8 w-full py-3 px-4 bg-[#F5F5F5] text-[#9A9A9A] font-semibold rounded-[12px] text-[14px] md:text-[15px] inline-flex items-center justify-center cursor-default select-none">
                      Website Coming Soon
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Info Section */}
          <div className="mt-16 md:mt-20 p-8 md:p-12 bg-white rounded-[24px] border border-[#E5E5E5] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <h3 className="text-[20px] md:text-[24px] font-semibold text-[#4A4A4A] mb-4">More Companies Coming Soon</h3>
            <p className="text-[15px] md:text-[16px] text-[#666666] leading-relaxed mb-6">
              SIIF is continuously incubating and accelerating innovative startups across diverse domains. More of our
              portfolio companies will be featured here as we expand our community of founders and innovators.
            </p>
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 text-[13px] md:text-[14px] font-medium text-[#9A9A9A]">
              <div className="flex items-start gap-3">
                <span className="text-[#FF3B3B] text-lg">✓</span>
                <span>Cutting-edge solutions across multiple sectors</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#FF3B3B] text-lg">✓</span>
                <span>Founded by exceptional entrepreneurs</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
