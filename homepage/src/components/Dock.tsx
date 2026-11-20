import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X } from 'lucide-react'

interface Space {
  id: string
  name: string
  avatar?: string
}

interface DockProps {
  spaces: Space[]
  activeContext: { type: 'dms' | 'space' | 'request'; id?: string }
  onContextChange: (context: { type: 'dms' | 'space' | 'request'; id?: string }) => void
  pendingCount?: number
  onQuickStartChat?: () => void
}

export default function Dock({ spaces, activeContext, onContextChange, pendingCount = 0, onQuickStartChat }: DockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCarousel, setIsCarousel] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState(0)

  useEffect(() => {
    if (!dockRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        setIsCarousel(width > window.innerWidth * 0.8)
      }
    })

    resizeObserver.observe(dockRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStart - e.changedTouches[0].clientY
    if (deltaY > 50) {
      setIsExpanded(true)
    }
  }

  const handleClickExpand = () => {
    setIsExpanded(true)
  }

  return (
    <>
      {/* Dock */}
      <motion.div
        ref={dockRef}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="matte-dock"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: '9999px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9999,
          overflowX: isCarousel ? 'scroll' : 'visible',
          whiteSpace: isCarousel ? 'nowrap' : 'normal',
          maxWidth: isCarousel ? '80vw' : 'none'
        }}
      >
        {/* DMs Master */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (activeContext.type === 'dms' && onQuickStartChat) {
              onQuickStartChat()
            } else {
              onContextChange({ type: 'dms' })
            }
          }}
          className={`relative p-3 rounded-full flex items-center justify-center transition-all ${
            activeContext.type === 'dms' ? 'bg-[var(--app-accent)] text-white' : 'bg-transparent hover:bg-[var(--app-border)] text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {pendingCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[var(--app-panel)] text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.8)]">
              {pendingCount}
            </div>
          )}
        </motion.button>

        {/* Spaces */}
        {spaces.map((space) => (
          <motion.button
            key={space.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onContextChange({ type: 'space', id: space.id })}
            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all text-lowercase-tight ${
              activeContext.type === 'space' && activeContext.id === space.id
                ? 'bg-app-accent text-white'
                : 'hover:bg-app-border'
            }`}
            style={{
              backgroundColor: activeContext.type === 'space' && activeContext.id === space.id ? 'var(--app-accent)' : 'transparent',
              color: activeContext.type === 'space' && activeContext.id === space.id ? '#fff' : 'var(--text-primary)'
            }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeContext.type === 'space' && activeContext.id === space.id ? 'bg-white/20' : 'bg-app-accent text-white'}`}>
              {space.name[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{space.name.toLowerCase()}</span>
          </motion.button>
        ))}

        {/* Expand Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClickExpand}
          className="px-3 py-2 rounded-full flex items-center justify-center hover:bg-app-border transition-all"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </motion.button>
      </motion.div>

      {/* Expanded Grid Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="absolute top-8 right-8 z-50">
              <button 
                onClick={() => setIsExpanded(false)} 
                className="p-3 text-white/70 hover:text-white transition-colors rounded-full border-2 border-white/20 hover:border-white/50 flex items-center gap-2 font-bold group"
              >
                <span className="text-xs group-hover:text-white">ESC</span>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '1200px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                padding: '24px'
              }}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* DMs Master */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onContextChange({ type: 'dms' })
                    setIsExpanded(false)
                  }}
                  className="matte-sidebar rounded-xl p-6 cursor-pointer hover:bg-app-border transition-all border border-app-border"
                >
                  <div className="w-12 h-12 rounded-full bg-app-accent flex items-center justify-center text-white text-lg font-bold mb-3 shadow-lg">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-app-text font-bold text-lg text-lowercase-tight">dms</h3>
                  <p className="text-app-muted text-sm mt-1 text-lowercase-tight">direct messages</p>
                </motion.div>

                {/* Spaces */}
                {spaces.map((space) => (
                  <motion.div
                    key={space.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onContextChange({ type: 'space', id: space.id })
                      setIsExpanded(false)
                    }}
                    className="matte-sidebar rounded-xl p-6 cursor-pointer hover:bg-app-border transition-all border border-app-border"
                  >
                    <div className="w-12 h-12 rounded-full bg-app-accent flex items-center justify-center text-white text-lg font-bold mb-3 shadow-lg">
                      {space.name[0].toUpperCase()}
                    </div>
                    <h3 className="text-app-text font-bold text-lg text-lowercase-tight">{space.name.toLowerCase()}</h3>
                    <p className="text-app-muted text-sm mt-1 text-lowercase-tight">space</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
