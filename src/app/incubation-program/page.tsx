'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function IncubationProgramPage() {
  const programHighlights = [
    {
      title: 'Mentorship',
      description: 'Get guidance from experienced entrepreneurs and industry experts'
    },
    {
      title: 'Funding Support',
      description: 'Access to capital and networking with investors'
    },
    {
      title: 'Facilities',
      description: 'State-of-the-art workspace, lab, and resources'
    },
    {
      title: 'Market Validation',
      description: 'Technical consulting and product development support'
    },
    {
      title: 'Network',
      description: 'Connect with other founders, mentors, and industry leaders'
    },
    {
      title: 'Business Services',
      description: 'Legal, accounting, branding, and marketing assistance'
    }
  ];

  const admissionSteps = [
    {
      step: 'Step 1',
      title: 'Application Submission',
      description: 'Applicants must submit a formal incubation request including:',
      points: [
        'A brief Business Plan or Lean Canvas',
        'Technical details of the prototype or innovation',
        'Profiles of the founding team',
      ],
    },
    {
      step: 'Step 2',
      title: 'Advisory Board Screening',
      description: 'The Advisory Board, chaired by the CEO, shall review applications to:',
      points: [
        'Evaluate technical viability and market potential',
        'Identify startup potential among students and alumni',
        'Verify the requirement for institutional resources (labs, mentorship, etc.)',
      ],
    },
    {
      step: 'Step 3',
      title: 'Selection Committee Pitch',
      description:
        'Shortlisted candidates shall present their venture before the Selection Committee, led by the CEO and supported by domain experts.',
      points: ['The committee shall assess team commitment, execution ability, and scalability.'],
    },
    {
      step: 'Step 4',
      title: 'Final Approval & Onboarding',
      description: 'Approved candidates move to final decision and onboarding formalities:',
      points: [
        'CEO Decision: The CEO shall have authority to approve or reject applications based on recommendations and strategic fit',
        'Agreement Execution: Approved startups shall sign a Memorandum of Understanding (MoU) or Incubation Agreement with SIIF',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}>
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex flex-col justify-center pt-24 overflow-hidden bg-white">
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="tracking-tighter mb-8"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(2.5rem, 5vw, 68px)',
                fontWeight: 600,
                lineHeight: '98.155%',
                letterSpacing: '-2.72px',
              }}
            >
              <span style={{
                background: 'linear-gradient(180deg, #5D5B5B 63.86%, #D5D0D0 89.74%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Incubation{' '}
              </span>
              <span style={{
                background: 'linear-gradient(90deg, #2AA0D3 0%, #F00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Program
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg leading-relaxed max-w-2xl mb-8"
              style={{
                color: '#565555',
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(0.95rem, 1.8vw, 18px)',
                fontWeight: 400,
                lineHeight: '1.6',
              }}
            >
              Transforming innovative ideas into thriving startups. Our comprehensive incubation program provides mentorship, resources, and network to help you succeed.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link href="/apply-incubation">
                <Button 
                  size="lg"
                  className="text-white px-10 py-7 text-lg font-bold shadow-xl transition-all hover:scale-105 active:scale-95 border-none"
                  style={{
                    fontFamily: 'var(--font-hanken-grotesk)',
                    borderRadius: '74px',
                    background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
                  }}
                >
                  Apply Now
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Program Highlights Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#F5F6F7]">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-12">
            <p className="text-base md:text-[18px] font-medium text-[#9A9A9A] mb-3 tracking-wide">
              What We Offer
            </p>
            <h2 
              className="tracking-tight"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(1.75rem, 3vw, 40px)',
                fontWeight: 600,
                lineHeight: '1.4',
                color: '#4A4A4A',
                letterSpacing: '-1.2px'
              }}
            >
              Complete Startup Support
            </h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programHighlights.map((highlight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 border-0 shadow hover:shadow-lg transition-shadow duration-300 h-full bg-white">
                  <h3 
                    className="font-semibold mb-3"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#FF3B3B',
                      lineHeight: '1.4'
                    }}
                  >
                    {highlight.title}
                  </h3>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#8A8A8A',
                      lineHeight: '1.5'
                    }}
                  >
                    {highlight.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Timeline Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-12">
            <p className="text-base md:text-[18px] font-medium text-[#9A9A9A] mb-3 tracking-wide">
              Your Journey
            </p>
            <h2 
              className="tracking-tight"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: 'clamp(1.75rem, 3vw, 40px)',
                fontWeight: 600,
                lineHeight: '1.4',
                color: '#4A4A4A',
                letterSpacing: '-1.2px'
              }}
            >
              4-Step Admission Process
            </h2>
            <p
              className="mx-auto mt-4 max-w-3xl"
              style={{
                fontFamily: '"Hanken Grotesk", sans-serif',
                fontSize: '16px',
                color: '#6F6F6F',
                lineHeight: '1.6',
              }}
            >
              The admission process is designed to be transparent and merit-based, supported by the Advisory Board.
            </p>
          </motion.div>
          
          <div className="space-y-6">
            {admissionSteps.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6 items-start p-6 rounded-lg hover:bg-[#F5F6F7] transition-colors duration-300"
              >
                <div className="flex-shrink-0">
                  <div 
                    className="flex items-center justify-center h-14 w-14 rounded-full text-white font-semibold text-lg"
                    style={{
                      background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
                <div className="flex-grow">
                  <p
                    className="mb-1"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#FF3B3B',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.step}
                  </p>
                  <h3 
                    className="font-semibold mb-1"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#4A4A4A',
                      lineHeight: '1.4'
                    }}
                  >
                    {item.title}
                  </h3>
                  <p 
                    className="mb-3"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#8A8A8A',
                      lineHeight: '1.5'
                    }}
                  >
                    {item.description}
                  </p>
                  <ul className="space-y-1.5 pl-5">
                    {item.points.map((point) => (
                      <li
                        key={point}
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#6A6A6A',
                          lineHeight: '1.55',
                          listStyleType: 'disc',
                        }}
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-[#F5F6F7]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="tracking-tight mb-6"
            style={{
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: 'clamp(1.75rem, 3vw, 48px)',
              fontWeight: 600,
              lineHeight: '1.2',
              letterSpacing: '-1.92px',
              color: '#4A4A4A'
            }}
          >
            Ready to Start?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg leading-relaxed max-w-2xl mx-auto mb-8"
            style={{
              color: '#565555',
              fontFamily: '"Hanken Grotesk", sans-serif',
              fontSize: 'clamp(0.95rem, 1.8vw, 18px)',
              fontWeight: 400,
              lineHeight: '1.6',
            }}
          >
            Apply now to join our next cohort of innovative startups and transform your idea into reality.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Link href="/apply-incubation">
              <Button 
                size="lg"
                className="text-white px-10 py-7 text-lg font-bold shadow-xl transition-all hover:scale-105 active:scale-95 border-none"
                style={{
                  fontFamily: 'var(--font-hanken-grotesk)',
                  borderRadius: '74px',
                  background: 'radial-gradient(76.17% 53.63% at 47.52% 111.03%, #8F1D5D 0%, rgba(102, 102, 102, 0.00) 100%), linear-gradient(90deg, #700333 0%, #E81116 100%)'
                }}
              >
                Apply for Incubation
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
