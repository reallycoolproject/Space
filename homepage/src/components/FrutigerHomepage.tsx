import { Link } from 'react-router-dom';
import { Info, FileText, MessageCircle, Phone, ArrowRight, Users, LockKeyhole, Sparkles } from 'lucide-react';

interface FrutigerHomepageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export default function FrutigerHomepage({ onSignIn, onSignUp }: FrutigerHomepageProps) {
  return (
    <div className="landing-frutiger min-h-screen font-sans text-[var(--text-primary)]">
      <nav className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="Space home">
          <span className="landing-brand-mark">S</span>
          <span>Space</span>
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/more-info" className="landing-nav-link"><Info className="h-4 w-4" />About</Link>
          <Link to="/docs" className="landing-nav-link"><FileText className="h-4 w-4" />Help & tips</Link>
          <Link to="/support" className="landing-nav-link"><MessageCircle className="h-4 w-4" />Support</Link>
          <Link to="/contact" className="landing-nav-link"><Phone className="h-4 w-4" />Contact</Link>
        </div>
        <button onClick={onSignIn} className="landing-gloss-button landing-gloss-button-light">Sign in</button>
      </nav>

      <main className="landing-hero relative overflow-hidden">
        {/* Animated Aurora Waves Background */}
        <div className="landing-aurora-container" aria-hidden="true">
          <div className="landing-aurora-wave landing-aurora-wave-1" />
          <div className="landing-aurora-wave landing-aurora-wave-2" />
          <div className="landing-aurora-wave landing-aurora-wave-3" />
        </div>

        <div className="landing-copy relative z-10">
          <div className="landing-eyebrow"><Sparkles className="h-4 w-4" /> YOUR PEOPLE ARE HERE</div>
          <h1>Space</h1>
          <p className="landing-tagline">Good chats.<br /><span>Your kind of space.</span></p>
          <p className="landing-description">
            Message a friend, start a group chat, or pick a look that feels right. Space keeps your conversations together without getting in the way.
          </p>
          <div className="landing-actions">
            <button onClick={onSignUp} className="landing-gloss-button landing-gloss-button-primary">
              Make your Space <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onSignIn} className="landing-gloss-button landing-gloss-button-light">
              I have an account
            </button>
          </div>
          <div className="landing-stamps">
            <span><LockKeyhole className="h-4 w-4" /> Private by design</span>
            <span><Users className="h-4 w-4" /> Friends & groups</span>
          </div>
        </div>
      </main>

      <section className="landing-ribbon">
        <div className="landing-feature"><span className="landing-feature-number">01</span><div><h2>Talk like you mean it</h2><p>Private chats for the everyday stuff and the big stuff.</p></div></div>
        <div className="landing-feature"><span className="landing-feature-number">02</span><div><h2>Bring everyone together</h2><p>Make a group with your friends and keep the fun going.</p></div></div>
        <div className="landing-feature"><span className="landing-feature-number">03</span><div><h2>Set it up your way</h2><p>Choose a theme, set your status, and adjust things as you go.</p></div></div>
      </section>
      <footer className="landing-footer flex flex-wrap items-center justify-between gap-4 py-4 px-6 border-t border-[var(--app-border)]/40 bg-[var(--app-panel)]/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="landing-brand-mark landing-brand-mark-small">S</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">Space · made for your circle</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-[var(--text-secondary)]">
          <Link to="/terms" className="hover:text-[var(--app-accent)] transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-[var(--app-accent)] transition-colors">Privacy Policy</Link>
          <Link to="/more-info" className="hover:text-[var(--app-accent)] transition-colors">About</Link>
          <Link to="/support" className="hover:text-[var(--app-accent)] transition-colors">Support</Link>
          <Link to="/qa" className="hover:text-[var(--app-accent)] transition-colors">FAQ</Link>
          <Link to="/contact" className="hover:text-[var(--app-accent)] transition-colors">Contact</Link>
        </div>
        <span className="landing-footer-sparkle text-xs opacity-70">✿ ✦ ❀</span>
      </footer>
    </div>
  );
}
