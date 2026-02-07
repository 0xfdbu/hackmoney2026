import { useEffect, useRef, useState } from 'react';
import Swap from './Swap';
import { Shield, Clock, Key, ArrowRight, Lock, EyeOff, Wallet } from 'lucide-react';

// Feature card component
function FeatureCard({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: number }) {
  return (
    <div 
      className="group relative bg-white rounded-3xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// How it works section
function HowItWorks() {
  const steps = [
    {
      icon: Lock,
      step: "01",
      title: "Commit",
      description: "Generate a cryptographic commitment that hides your trade amount. Your order is submitted to the dark pool without revealing sensitive information."
    },
    {
      icon: Clock,
      step: "02",
      title: "Wait",
      description: "A 10-block delay ensures MEV bots cannot frontrun your trade. Your commitment is stored securely while the clock ticks down."
    },
    {
      icon: Key,
      step: "03",
      title: "Reveal & Execute",
      description: "After the delay, reveal your secret salt to execute the swap. The dark pool verifies your commitment and processes the trade."
    }
  ];

  return (
    <div className="py-20">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          How It Works
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          PrivyFlow uses a commit-reveal scheme to protect your trades from MEV attacks
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((item, index) => (
          <div key={index} className="relative">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-pink-500 to-purple-500" />
            )}
            
            <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-4xl font-bold text-gray-200">{item.step}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Home component
export default function Home() {
  const swapRef = useRef<HTMLDivElement>(null);

  const scrollToSwap = () => {
    swapRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50">
      {/* Hero Section with Swap */}
      <section ref={swapRef} className="pt-20 sm:pt-24 pb-12 sm:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Hero Content */}
            <div className="order-1">
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-pink-100 rounded-full text-pink-700 text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Privacy-First DeFi</span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4 sm:mb-6">
                  Trade Without{' '}
                  <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                    Revealing
                  </span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed mb-6 sm:mb-8">
                  The first dark pool DEX on Uniswap v4. Hide your trade amounts, 
                  prevent MEV attacks, and execute swaps with complete privacy.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button 
                    onClick={scrollToSwap}
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30 transition-all flex items-center justify-center sm:justify-start gap-2"
                  >
                    Start Trading
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <a 
                    href="#how-it-works"
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-gray-700 rounded-2xl font-semibold border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-center"
                  >
                    Learn More
                  </a>
                </div>
              </div>

              {/* Mini feature list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 text-gray-700 p-2 sm:p-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-sm sm:text-base">Hidden Amounts</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-gray-700 p-2 sm:p-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-sm sm:text-base">MEV Protection</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-gray-700 p-2 sm:p-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <span className="font-medium text-sm sm:text-base">No Front-running</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-gray-700 p-2 sm:p-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600" />
                  </div>
                  <span className="font-medium text-sm sm:text-base">10-Block Delay</span>
                </div>
              </div>
            </div>
            
            {/* Right: Swap Component */}
            <div className="order-2">
              <Swap />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <HowItWorks />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Choose PrivyFlow?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Built on Uniswap v4 hooks, PrivyFlow brings institutional-grade privacy to DeFi
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={Shield}
              title="MEV Protection"
              description="10-block delay prevents sandwich attacks and frontrunning by MEV bots"
              delay={0}
            />
            <FeatureCard 
              icon={EyeOff}
              title="Hidden Amounts"
              description="Your trade size remains hidden until execution using cryptographic commitments"
              delay={100}
            />
            <FeatureCard 
              icon={Lock}
              title="Trustless"
              description="Fully decentralized and trustless. No central authority controls your funds"
              delay={200}
            />
            <FeatureCard 
              icon={Wallet}
              title="Low Fees"
              description="Leverages Uniswap v4's efficient routing for minimal trading costs"
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-3xl p-12 text-center text-white shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Trade Privately?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Join the future of private DeFi trading. Experience MEV-resistant swaps with complete amount privacy.
            </p>
            <button 
              onClick={scrollToSwap}
              className="px-8 py-4 bg-white text-pink-600 rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              Launch App
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
