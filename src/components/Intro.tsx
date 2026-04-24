'use client';

export function Intro() {
  return (
    <>
      <section
        className="relative w-full h-auto overflow-hidden bg-[#F5F6F7] flex flex-col items-center px-4 pt-[5vh] pb-[4vh]"
        style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}
      >

        <div className="relative z-20 w-full max-w-[860px] flex flex-col items-center text-center mx-auto shrink-0">
          <p className="text-base md:text-[18px] font-medium text-[#9A9A9A] mb-3 tracking-wide">
            What is SIIF?
          </p>
          <h1 className="text-[22px] md:text-[28px] lg:text-[36px] font-semibold leading-[1.4] tracking-tight text-[#4A4A4A]">
            SJCET&apos;s structured home for early-stage{' '}
            <br className="hidden md:block" />
            <span className="text-[#FF3B3B]">founders mentorship</span>,{' '}
            <span className="text-[#FF3B3B]">prototyping</span>,{' '}
            <span className="text-[#FF3B3B]">funding</span>,
            <br className="hidden md:block" />
            and a community that pushes back.
          </h1>
        </div>

        <div className="flex w-full max-w-[1300px] mx-auto mt-6 px-0 md:px-6 items-end justify-center shrink-0">

          <div
            className="flex-[1.4] flex items-start justify-end relative z-30"
            style={{ marginBottom: 'clamp(30px, 12vw, 160px)' }}
          >
            <img
              src="assets/intro-leftcube.png"
              alt="Left Cube"
              className="w-[180%] max-w-[360px] object-contain drop-shadow-xl transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.05]"
            />
          </div>

          <div
            className="flex-[1.1] flex items-end justify-center relative z-30 -mr-[6%] md:-mr-[4%]"
            style={{ marginBottom: 'clamp(80px, 35vw, 370px)' }}
          >
            <img
              src="assets/intro-leftglow.png"
              alt="Left Glow"
              className="w-[150%] max-w-[280px] object-contain drop-shadow-xl transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.05]"
            />
          </div>

          <div className="flex-[3.5] flex items-end justify-center relative z-20 -mx-[8%] md:-mx-[5%]">
            <img
              src="assets/intro-platform.png"
              alt="SIIF Platform"
              className="w-[115%] md:w-[105%] max-w-[550px] object-contain drop-shadow-2xl transition-transform duration-500 ease-out hover:-translate-y-4"
            />
          </div>

          <div className="flex-[1.1] flex items-end justify-center relative z-30 -mr-[6%] md:-mr-[4%]">
            <img
              src="assets/intro-rightstack.png"
              alt="Right Stack"
              className="w-[150%] max-w-[280px] object-contain drop-shadow-xl transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.05]"
            />
          </div>

          <div
            className="flex-[1.4] flex items-end justify-start relative z-30"
            style={{ marginBottom: 'clamp(60px, 18vw, 200px)' }}
          >
            <img
              src="assets/intro-rightglass.png"
              alt="Right Glass"
              className="w-[180%] max-w-[360px] object-contain drop-shadow-xl transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.05]"
            />
          </div>
        </div>


        <div className="relative z-20 w-full flex justify-center shrink-0 mt-6 md:mt-8">
          <p className="text-sm text-[#8A8A8A] text-center max-w-[420px] leading-relaxed">
            If you have a problem worth solving,
            <br />
            we have everything else.
          </p>
        </div>
      </section>

      {/* Stats + Video Showcase Section */}
      <section
        className="w-full bg-[#F5F6F7] flex justify-center py-[60px] md:py-[80px] px-6"
        style={{ fontFamily: 'var(--font-hanken-grotesk), sans-serif' }}
      >
        <div className="max-w-[1100px] w-full grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-[32px] md:gap-[48px] items-center">
          <div className="w-full h-[200px] md:h-[260px] bg-[#E5E5E5] rounded-[24px] flex items-center justify-center relative shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05),inset_-4px_-4px_10px_rgba(255,255,255,0.8)] cursor-pointer group overflow-hidden">
            <div className="w-0 h-0 border-t-18 border-t-transparent border-l-30 border-l-[#9A9A9A] border-b-18 border-b-transparent transition-transform duration-200 ease-out group-hover:scale-110 z-10" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-[24px] gap-y-[24px]">
            <div className="flex flex-col gap-[24px]">
              <StatCard number="50" highlight="+" label="Seats" />
              <StatCard number="5" highlight="" label="5 Seater Cabins" />
            </div>
            <div className="flex flex-col gap-[24px] sm:mt-[40px] md:mt-[60px]">
              <StatCard number="24" highlight="Hrs" label="Uninterrupted Power Supply" />
              <StatCard number="50" highlight="+" label="entors & Experts" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StatCard({ number, highlight, label, }: { number: string; highlight: string; label: string; }) {
  return (
    <div className="p-[5px] rounded-[32px] bg-linear-to-r from-[#FFFFFF] to-[#FDFDFD]">
      <div className="bg-[#F8F8F8] rounded-[28px] p-[28px_24px] flex flex-col justify-center min-h-[140px] shadow-[0_12px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out hover:-translate-y-2">
        <div className="flex items-baseline gap-[2px]">
          <span className="text-[44px] lg:text-[54px] font-bold text-[#4A4A4A] tracking-tight leading-none">
            {number}
          </span>
          <span className="text-[44px] lg:text-[54px] font-bold tracking-tight leading-none bg-linear-to-r from-[#F12837] to-[#B40591] bg-clip-text text-transparent">
            {highlight}
          </span>
        </div>
        <p className="text-[15px] lg:text-[17px] font-medium text-[#666666] mt-[10px] tracking-wide">
          {label}
        </p>
      </div>
    </div>
  );
}