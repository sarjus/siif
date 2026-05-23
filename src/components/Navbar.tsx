"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const navLinks = [
  { name: "Home", href: "/" },
  {
    name: "About Us",
    href: "/about-siif",
    subLinks: [
      { name: "About SIIF", href: "/about-siif" },
      { name: "Management Team", href: "/management-team" },
      { name: "SIIF In Media", href: "/media" },
      { name: "Network", href: "/network" },
    ]
  },
  {
    name: "Incubation",
    href: "/incubation-program",
    subLinks: [
      { name: "Incubation Program", href: "/incubation-program" },
      { name: "Facilities", href: "/facilities" },
      { name: "Mentoring", href: "/mentoring" },
      { name: "Selection", href: "/selection" },
      { name: "Funding", href: "/funding" },
      { name: "Apply For Incubation", href: "/apply-incubation" },
    ]
  },
  {
    name: "Startups",
    href: "/current-companies",
    subLinks: [
      { name: "Current Companies", href: "/current-companies" },
      { name: "Graduated Companies", href: "/graduated-companies" },
      { name: "Testimonials", href: "/testimonials" },
      { name: "Awards & Recognition", href: "/awards" },
    ]
  },
  {
    name: "Programs",
    href: "/sponsored-programs",
    subLinks: [
      { name: "Sponsored Programs", href: "/sponsored-programs" },
      { name: "Workshops", href: "/workshops" },
      { name: "Trainings", href: "/trainings" },
      { name: "Other Events", href: "/events" },
    ]
  },
  { name: "Schemes", href: "/schemes" },
  { name: "Gallery", href: "/gallery" },
  { name: "Careers", href: "https://internship.siifincubator.org/" },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMobileSubMenu, setActiveMobileSubMenu] = useState<string | null>(null);

  const toggleMobileSubMenu = (name: string) => {
    setActiveMobileSubMenu(activeMobileSubMenu === name ? null : name);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="w-full h-auto py-4 flex items-center justify-between px-5 md:px-12 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <Image
              src="/assets/College Logo.png"
              alt="SJCET College Logo"
              width={360}
              height={200}
              className="h-10 md:h-12 lg:h-14 w-auto max-w-[220px] object-contain"
              priority
            />
            <Image
              src="/assets/SIIF Logo.png"
              alt="SIIF Logo"
              width={160}
              height={80}
              className="h-10 md:h-12 lg:h-14 w-auto object-contain"
              priority
            />
            <span
              className="leading-none text-[1.55rem] md:text-[2rem] lg:text-[2.4rem] font-semibold tracking-tight"
              style={{
                color: '#5D5B5B',
                fontFamily: '"Hanken Grotesk", sans-serif',
              }}
            >
              SIIF.
            </span>
          </Link>
        </div>

        <NavigationMenu viewport={false} className="hidden lg:flex ml-auto max-w-none">
          <NavigationMenuList className="gap-4">
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.name}>
                {link.subLinks && link.subLinks.length > 0 ? (
                  <>
                    <NavigationMenuTrigger
                      className={cn(
                        "bg-transparent hover:bg-[#FFF5F5] hover:text-primary focus:bg-[#FFF5F5] px-4 py-2 rounded-full transition-all duration-300",
                        "data-[state=open]:text-primary data-[state=open]:bg-[#FFF5F5]"
                      )}
                      style={{
                        color: '#000',
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        letterSpacing: '-0.3px',
                      }}
                    >
                      {link.name}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="md:absolute md:top-full md:left-0 md:mt-2">
                      <ul className="grid w-[220px] gap-1 p-2 bg-white rounded-xl shadow-2xl border border-black/5">
                        {link.subLinks.map((sub) => (
                          <li key={sub.name}>
                            <NavigationMenuLink asChild>
                              <Link
                                href={sub.href}
                                className="block select-none space-y-1 rounded-lg p-3 leading-none no-underline outline-none transition-colors hover:bg-[#FFF5F5] hover:text-primary focus:bg-[#FFF5F5] focus:text-primary"
                              >
                                <div className="text-sm font-semibold leading-none" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
                                  {sub.name}
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </>
                ) : (
                  <NavigationMenuLink asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "bg-transparent hover:bg-transparent hover:text-primary focus:bg-transparent px-2 w-auto justify-start"
                      )}
                      style={{
                        color: '#000',
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        letterSpacing: '-0.3px',
                      }}
                    >
                      {link.name}<span className="text-primary ml-0.5">.</span>
                    </Link>
                  </NavigationMenuLink>
                )}
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden lg:flex ml-8">
          <Link
            href="/apply-incubation"
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-sm tracking-tight hover:bg-black transition-all duration-300 shadow-lg shadow-primary/20"
            style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
          >
            Apply Now
          </Link>
        </div>

        <div
          className="flex items-center lg:hidden cursor-pointer p-2 -mr-2 text-black hover:text-primary transition-colors"
          onClick={() => {
            if (isMobileMenuOpen) {
              setActiveMobileSubMenu(null);
            }
            setIsMobileMenuOpen(!isMobileMenuOpen);
          }}
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-white backdrop-blur-lg border-b border-black/5 flex flex-col py-4 px-6 shadow-2xl lg:hidden z-50 max-h-[85vh] overflow-y-auto"
          >
            {navLinks.map((link) => (
              <div key={link.name} className="w-full border-b border-black/5 last:border-0">
                {link.subLinks && link.subLinks.length > 0 ? (
                  <div className="w-full py-4">
                    <button
                      onClick={() => toggleMobileSubMenu(link.name)}
                      className="w-full flex items-center justify-between text-[17px] font-bold text-black/80 hover:text-primary transition-colors"
                      style={{ fontFamily: '"Hanken Grotesk", sans-serif', letterSpacing: '-0.5px' }}
                    >
                      <span>{link.name}<span className="text-primary ml-0.5">.</span></span>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 transition-transform duration-300",
                          activeMobileSubMenu === link.name && "rotate-180"
                        )}
                      />
                    </button>
                    <AnimatePresence>
                      {activeMobileSubMenu === link.name && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-2 mt-4 ml-4 border-l-2 border-primary/20 pl-4">
                            {link.subLinks.map((sub) => (
                              <Link
                                key={sub.name}
                                href={sub.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="py-2 text-[15px] font-semibold text-black/60 hover:text-primary transition-colors"
                                style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full py-4 text-[17px] font-bold text-black/80 hover:text-primary transition-colors"
                    style={{ fontFamily: '"Hanken Grotesk", sans-serif', letterSpacing: '-0.5px' }}
                  >
                    {link.name}<span className="text-[#F12837] ml-0.5">.</span>
                  </Link>
                )}
              </div>
            ))}
            <div className="mt-6 mb-4">
              <Link
                href="/apply-incubation"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full py-4 bg-primary text-white text-center rounded-xl font-bold text-[17px] shadow-lg shadow-primary/20"
                style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
              >
                Apply Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}