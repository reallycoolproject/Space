import { motion } from 'framer-motion';
import { Shield, Lock, Users, Zap, Heart, ArrowLeft, Sparkles, Monitor, Layers, Smile, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MoreInfo() {
  const features = [
    {
      icon: <Users className="w-5 h-5 text-sky-500" />,
      title: 'Spaces & Custom Channels',
      desc: 'Build your own community clubhouse with organized categories, a lot of roles, announcement boards, and some giveaways whenever you feel generous.'
    },
    {
      icon: <Lock className="w-5 h-5 text-indigo-500" />,
      title: 'Private Encrypted DMs',
      desc: 'Your one-on-one DMs are locked directly on your device. Only you and the person you talk to can read them.'
    },
    {
      icon: <Volume2 className="w-5 h-5 text-emerald-500" />,
      title: 'Voice Hangouts & Video Calling',
      desc: 'Hop into VCs, share your screen, turn on camera, or just... scream into the mic?.'
    },
    {
      icon: <Smile className="w-5 h-5 text-pink-500" />,
      title: 'Custom Stickers & Emojis',
      desc: 'Express yourself with animated emojis, custom community sticker packs with creator tags, and personalized backgrounds for every chat.'
    },
    {
      icon: <Layers className="w-5 h-5 text-amber-500" />,
      title: '16 Aesthetic Themes & Studio',
      desc: 'Choose from Frutiger Aero, Aqua, Eco, Aurora, Metro, Emo, Goth, and more. Tweak backgrounds, surface glows, and colors however you want.'
    },
    {
      icon: <Shield className="w-5 h-5 text-cyan-500" />,
      title: '100% Free & Zero Ads',
      desc: 'No Subscriptions, no paywalls, and no locking basic features like custom avatars, HD streaming, or server emojis behind some paywalls.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans py-10 px-4 sm:px-6">
      {/* Top Navigation */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 shadow-md text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-700 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
          Back to Space
        </Link>
        <div className="flex items-center gap-2">
          <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full uppercase">
            ✦ About Space ✦
          </span>
        </div>
      </div>

      {/* Main Aero Desktop Window */}
      <div className="max-w-5xl mx-auto frutiger-window shadow-2xl">
        {/* Titlebar */}
        <div className="frutiger-window-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
              About Space
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="frutiger-window-dot bg-amber-400 border border-amber-300 cursor-pointer" title="Minimize" />
            <span className="frutiger-window-dot bg-emerald-400 border border-emerald-300 cursor-pointer" title="Maximize" />
            <Link to="/" className="frutiger-window-dot bg-rose-500 border border-rose-400 cursor-pointer" title="Close" />
          </div>
        </div>

        {/* Window Interior Body */}
        <div className="p-6 sm:p-10 space-y-8 bg-slate-900">
          {/* Hero Header */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Good Chats. Real Privacy. Your Kind of Space.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
              Space brings people together with customizable servers and private messaging with real personality. No ad tracking, no algorithmic noise, and zero subscription paywalls.
            </p>
          </div>

          {/* User Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ★ 100% FREE & ZERO ADS ★
            </span>
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ✦ PRIVATE ENCRYPTED DMs ✦
            </span>
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ★ CUSTOM SPACES & CHANNELS ★
            </span>
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ✦ HD VOICE & VIDEO ROOMS ✦
            </span>
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ★ VOICE NOTES & WAVEFORMS ★
            </span>
            <span className="frutiger-badge-retro text-[10px] px-3.5 py-1.5 rounded-full">
              ✦ CUSTOM EMOJIS & STICKERS ✦
            </span>
          </div>

          {/* Manifesto Box */}
          <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" /> Why I Built Space
            </h2>
            <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-medium">
              <p>
                I built Space around a simple idea: <strong>chat apps should respect you and feel great to use</strong>. When you hang out with friends or run a community, you should have access to rich voice rooms, custom roles, custom stickers, and vibrant aesthetics without being forced to pay $10 every month.
              </p>
              <p>
                <strong>Your privacy belongs to you, not advertisers</strong>. Mainstream platforms scan personal conversations and trade your contact graph to commercial data brokers. Space rejects that model completely. Your direct messages are encrypted on your local device before transmission so nobody in the middle can read your words.
              </p>
              <p className="font-bold text-white">
                Like Discord... but actually safer, with zero ads, and we actually have moderation.
              </p>
            </div>
          </div>

          {/* 6 Features Grid */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white text-center">
              Built for Friends, Creators & Communities
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feat, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-700 bg-slate-800/90 p-5 shadow-sm hover:border-sky-500 transition-all flex flex-col"
                >
                  <div className="p-2.5 rounded-xl bg-slate-700/60 w-fit mb-3">
                    {feat.icon}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action Box */}
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-700 text-white shadow-xl text-center space-y-3 relative overflow-hidden">
            <h3 className="text-xl sm:text-2xl font-black">Ready to make your Space?</h3>
            <p className="text-xs sm:text-sm text-sky-100 max-w-md mx-auto font-medium">
              Create your account in seconds with zero phone numbers, zero subscription fees, and full privacy.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link
                to="/"
                className="px-6 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-sky-50 font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                Launch Space
              </Link>
              <Link
                to="/terms"
                className="px-6 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-xs border border-white/40 transition-all"
              >
                Read Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
