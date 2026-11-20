import { motion } from 'framer-motion';
import { Scale, ShieldAlert, Lock, AlertTriangle, FileText, CheckCircle2, UserCheck, ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
  const lastUpdated = 'November 2026';

  const sections = [
    {
      id: 'acceptance',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      title: '1. Acceptance of Terms & Binding Agreement',
      content: `By registering an account, accessing, or using Space ("the Service", "we", "us", or "our"), you explicitly confirm that you have read, understood, and agreed to be legally bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to every provision of these Terms, you must immediately discontinue all use of Space.`
    },
    {
      id: 'eligibility',
      icon: <UserCheck className="w-5 h-5 text-sky-500" />,
      title: '2. Eligibility & Age Requirements',
      content: `You must be at least 13 years of age (or 16 years of age in the European Economic Area, United Kingdom, or the minimum legal age of digital consent in your jurisdiction) to create an account or use Space. By signing up, you represent and warrant that you meet this minimum age requirement and have the legal capacity to enter into a binding contract under applicable laws.`
    },
    {
      id: 'cryptography',
      icon: <Lock className="w-5 h-5 text-indigo-500" />,
      title: '3. Encrypted Messages & User Responsibility',
      content: `Space provides client-side encryption for your direct messages. Your encryption keys are generated right on your device and are never sent to or stored on our servers.

IMPORTANT NOTICE: Because Space never holds or manages your private keys or password, we cannot restore or recover your encrypted messages if you lose access to your account or device. You are responsible for safeguarding your login credentials and maintaining your account access.`
    },
    {
      id: 'zero-tolerance',
      icon: <ShieldAlert className="w-5 h-5 text-rose-500" />,
      title: '4. Zero-Tolerance Prohibited Conduct & Content',
      content: `Space maintains a strict, unconditional zero-tolerance policy against illegal, harmful, and abusive activities. You agree that you will not post, transmit, promote, or encourage any of the following:

• Child Sexual Abuse Material (CSAM): Any depiction, discussion, or promotion of child sexual abuse material or child exploitation is strictly prohibited. Any detected CSAM will result in instantaneous account termination, permanent hardware/IP blacklisting, and mandatory reporting to the National Center for Missing & Exploited Children (NCMEC) and relevant domestic and international law enforcement agencies.
• Non-Consensual Sexual Imagery: Non-consensual sharing of intimate images, deepfakes, or extortion (sextortion).
• Violence & Terrorist Activity: Direct threats of physical violence, incitement of mass violence, self-harm promotion, or dissemination of terrorist propaganda.
• Malware & Cyber Warfare: Uploading or distributing malware, viruses, trojans, ransomware, phishing scripts, or conducting denial-of-service (DDoS) attacks.
• Harassment, Doxxing & Impersonation: Target-harassment, stalkerware, non-consensual disclosure of personally identifiable information (doxxing), or impersonating staff or other users.

Violation of any prohibited conduct clause will result in immediate account termination and legal referral without prior warning.`
    },
    {
      id: 'spaces',
      icon: <Shield className="w-5 h-5 text-amber-500" />,
      title: '5. User-Generated Spaces & Community Moderation',
      content: `Space provides infrastructure allowing users to organize servers, channels, and voice rooms ("Spaces"). Space owners and designated moderators are responsible for maintaining order and policing their respective Spaces in compliance with these Terms.

You retain ownership of the content and messages you author. By submitting messages, files, or media through Space, you grant us only the limited, non-exclusive, worldwide, royalty-free license strictly necessary to transmit, buffer, temporarily cache, and deliver encrypted ciphertext across network WebSocket connections to your designated recipients.`
    },
    {
      id: 'warranties',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      title: '6. Disclaimer of Warranties ("AS IS")',
      content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED ON AN "AS IS", "WITH ALL FAULTS", AND "AS AVAILABLE" BASIS. SPACE EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS, STATUTORY, OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, NON-INFRINGEMENT, OR UNINTERRUPTED, SECURE, ERROR-FREE OPERATION. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR BE FREE FROM OUTAGES OR BUGS.`
    },
    {
      id: 'liability',
      icon: <Scale className="w-5 h-5 text-indigo-500" />,
      title: '7. Limitation of Liability',
      content: `TO THE FULLEST EXTENT PERMISSIBLE BY LAW, IN NO EVENT SHALL SPACE, ITS OPERATORS, FOUNDERS, DEVELOPERS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES (INCLUDING DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, REPUTATION, LOSS OF CRYPTOGRAPHIC KEYS, OR HARDWARE INCOMPATIBILITY), REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE).

UNDER NO CIRCUMSTANCES SHALL SPACE'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS EXCEED FIFTY UNITED STATES DOLLARS ($50.00 USD) OR THE AMOUNT PAID BY YOU TO SPACE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, WHICHEVER IS GREATER.`
    },
    {
      id: 'indemnification',
      icon: <FileText className="w-5 h-5 text-teal-500" />,
      title: '8. Indemnification',
      content: `You agree to defend, indemnify, and hold harmless Space, its creators, developers, contributors, and service providers from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable legal and accounting fees) arising from or related to: (a) your use or misuse of the Service; (b) any content, messages, or files you transmit; (c) your violation of these Terms; or (d) your infringement of any intellectual property, privacy, or legal rights of any third party.`
    },
    {
      id: 'termination',
      icon: <Lock className="w-5 h-5 text-cyan-500" />,
      title: '9. Account Termination & Changes to Terms',
      content: `You may delete your Space account at any time via Settings > Account. Space reserves the right to suspend, restrict, or permanently terminate your access to the Service at our sole discretion, without liability, if you violate these Terms or if required by law.

We reserve the right to revise or update these Terms as necessary. If we make material modifications, we will provide notice through the application. Continued use of Space following the effective date of updated Terms constitutes your full acceptance of the revisions.`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative overflow-x-hidden font-sans py-10 px-4 sm:px-6">
      {/* 3D Iridescent Soap Bubbles */}
      <div className="frutiger-bubble-realistic w-32 h-32 top-10 left-[6%] opacity-40 animate-float pointer-events-none" />
      <div className="frutiger-bubble-realistic w-48 h-48 top-80 right-[5%] opacity-35 animate-float pointer-events-none" style={{ animationDelay: '-3s' }} />
      <div className="frutiger-bubble-realistic w-24 h-24 bottom-32 left-[12%] opacity-30 animate-float pointer-events-none" style={{ animationDelay: '-6s' }} />

      {/* Top Navigation */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 shadow-md text-xs font-bold text-slate-200 hover:bg-slate-750 hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
          Back to Space
        </Link>
        <div className="flex items-center gap-2">
          <span className="frutiger-badge-retro text-[10px] px-2.5 py-1 rounded-full uppercase">
            ✦ Terms of Service ✦
          </span>
        </div>
      </div>

      {/* Main Aero Desktop Document Window */}
      <div className="max-w-4xl mx-auto frutiger-window shadow-2xl">
        {/* Aero Titlebar */}
        <div className="frutiger-window-titlebar px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
              Terms of Service
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="frutiger-window-dot bg-amber-400 border border-amber-300 cursor-pointer" title="Minimize" />
            <span className="frutiger-window-dot bg-emerald-400 border border-emerald-300 cursor-pointer" title="Maximize" />
            <Link to="/" className="frutiger-window-dot bg-rose-500 border border-rose-400 cursor-pointer" title="Close" />
          </div>
        </div>

        {/* Window Interior Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-slate-900">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-xs font-bold text-indigo-300">
              <Scale className="w-3.5 h-3.5" /> Enforceable Terms & Community Standards
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Terms of Service
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-medium">
              Please read these terms carefully. They govern your access to Space and set clear standards for encryption, community conduct, and liability protections.
            </p>
            <p className="text-[11px] font-bold text-slate-400">
              Effective & Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Quick Badges Banner */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
              <Lock className="w-4 h-4" /> Just a lil summary
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full">
                ★ ZERO TOLERANCE FOR ABUSE ★
              </span>
              <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full">
                ✦ CLIENT-SIDE ENCRYPTED DMs ✦
              </span>
              <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full">
                ★ RESPECTFUL COMMUNITIES ★
              </span>
              <span className="frutiger-badge-retro text-[10px] px-3 py-1 rounded-full">
                ✦ NO SPYWARE OR DATA SELLING ✦
              </span>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-4">
            {sections.map(section => (
              <motion.section
                key={section.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-xl border border-slate-700 bg-slate-800/90 p-5 shadow-sm hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="p-2 rounded-lg bg-slate-700/60 shadow-xs border border-slate-600">
                    {section.icon}
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    {section.title}
                  </h2>
                </div>
                <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line pl-1 font-medium">
                  {section.content}
                </div>
              </motion.section>
            ))}
          </div>

          {/* Footer Contact */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-center text-xs text-slate-300 font-medium shadow-sm">
            Questions regarding these Terms? Contact us via our{' '}
            <Link to="/contact" className="text-sky-400 font-bold underline hover:text-sky-300">
              Contact Page
            </Link>{' '}
            or submit a ticket in our{' '}
            <Link to="/support" className="text-sky-400 font-bold underline hover:text-sky-300">
              Support Center
            </Link>.
          </div>
        </div>

        {/* Clean Footer (No green dot or fake telemetry) */}
        <div className="px-5 py-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 select-none">
          <span>Space Legal & Terms</span>
          <span className="font-mono text-slate-400">TOS-2026-V2</span>
        </div>
      </div>
    </div>
  );
}
