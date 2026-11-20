import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ZoomIn, Upload, Check, Image as ImageIcon, RefreshCw, Sparkles } from 'lucide-react';

export interface CropResult {
  url: string;
  zoom: number;
  panX: number;
  panY: number;
  dim?: number;
  blur?: number;
  texture?: boolean;
}

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'banner' | 'wallpaper' | 'avatar';
  initialImage?: string;
  targetTitle?: string;
  onApply: (result: CropResult) => void;
}

export function ImageCropModal({
  isOpen,
  onClose,
  mode,
  initialImage = '',
  targetTitle,
  onApply
}: ImageCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string>(initialImage);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [dim, setDim] = useState<number>(30); // 30% default dim for readable chat
  const [blur, setBlur] = useState<number>(2); // 2px default blur
  const [texture, setTexture] = useState<boolean>(true);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setImageUrl(initialImage || '');
      setZoom(1);
      setPanX(0);
      setPanY(0);
    }
  }, [isOpen, initialImage]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
          setZoom(1);
          setPanX(0);
          setPanY(0);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panX,
      initialPanY: panY
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Convert delta pixels to percentage offset
    const pctX = (deltaX / rect.width) * 100;
    const pctY = (deltaY / rect.height) * 100;

    const maxPan = 50 * (zoom - 0.7);
    const newPanX = Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.initialPanX + pctX));
    const newPanY = Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.initialPanY + pctY));

    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleSave = () => {
    if (!imageUrl) return;
    onApply({
      url: imageUrl,
      zoom,
      panX,
      panY,
      dim: mode === 'wallpaper' ? dim : 0,
      blur: mode === 'wallpaper' ? blur : 0,
      texture: mode === 'wallpaper' ? texture : false
    });
    onClose();
  };

  const isBanner = mode === 'banner';
  const isAvatar = mode === 'avatar';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-md sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="my-auto flex min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl max-h-[min(92dvh,760px)]"
        style={{
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)'
        }}
      >
        {/* Frutiger Glass Window Header Bar */}
        <div 
          className="h-12 px-4 flex items-center justify-between border-b border-[var(--app-border)] select-none shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.1) 100%)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 shadow-sm border border-red-500/40" />
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm border border-amber-500/40" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm border border-emerald-500/40" />
            </div>
            <span className="text-xs font-black tracking-wider uppercase text-[var(--text-primary)] ml-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--app-accent)]" />
              {targetTitle ? targetTitle : (isBanner ? 'Profile banner' : 'Chat wallpaper')}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] text-[var(--text-secondary)] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
          {/* Image Input Options */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Paste image link or choose file..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputUrl.trim()) {
                    setImageUrl(inputUrl.trim());
                    setInputUrl('');
                  }
                }}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--bg-input)] text-[var(--text-input)] border border-[var(--border-input)] focus:outline-none focus:border-[var(--app-accent)]"
              />
              {inputUrl.trim() && (
                <button
                  onClick={() => {
                    setImageUrl(inputUrl.trim());
                    setInputUrl('');
                  }}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[var(--app-accent)] text-white hover:opacity-90"
                >
                  Load
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-secondary text-[var(--text-primary)] flex items-center justify-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                Upload Image
              </button>
            </div>
          </div>

          {/* Interactive Crop / Pan Viewport */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
              <span>Drag the image to adjust its position:</span>
              <span className="text-[10px] text-[var(--app-accent)]">Zoom: {zoom.toFixed(1)}x</span>
            </div>

            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative overflow-hidden ${
                isAvatar ? 'w-48 h-48 rounded-full mx-auto' : 'rounded-xl w-full'
              } border-2 border-[var(--app-accent)]/50 select-none ${
                imageUrl ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              } ${
                isAvatar ? '' : isBanner ? 'h-[clamp(8rem,22vh,11rem)]' : 'h-[clamp(8rem,28vh,14rem)]'
              } bg-black/40 flex items-center justify-center`}
              style={{
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
              }}
            >
              {imageUrl ? (
                <>
                  <div
                    className="absolute inset-0 bg-center bg-no-repeat transition-transform duration-75"
                    style={{
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: 'cover',
                      transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`,
                      filter: !isBanner ? `blur(${blur}px)` : 'none'
                    }}
                  />

                  {/* Dim overlay for Wallpaper preview */}
                  {!isBanner && dim > 0 && (
                    <div 
                      className="absolute inset-0 bg-black pointer-events-none transition-opacity"
                      style={{ opacity: dim / 100 }}
                    />
                  )}

                  {/* Retro Texture overlay */}
                  {!isBanner && texture && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20"
                      style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                        backgroundSize: '16px 16px'
                      }}
                    />
                  )}

                  {/* Crop Target Grid Lines */}
                  <div className="absolute inset-0 pointer-events-none border border-white/20">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30">
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-r border-b border-white" />
                      <div className="border-b border-white" />
                      <div className="border-r border-white" />
                      <div className="border-r border-white" />
                      <div />
                    </div>
                  </div>

                  {/* Drag Helper Chip */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/90 font-medium pointer-events-none">
                    Drag anywhere to pan
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[var(--text-secondary)]">
                  <ImageIcon className="w-10 h-10 opacity-40" />
                  <p className="text-xs">Upload an image or paste a link to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Controls: Zoom, Dim, Blur, Texture */}
          {imageUrl && (
            <div className="p-4 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] space-y-4">
              {/* Zoom Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                  <span className="flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                    Scale / Zoom:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoom(z => Math.max(1, z - 0.2))}
                      className="w-6 h-6 rounded bg-[var(--app-panel)] hover:bg-[var(--app-surface-hover)] flex items-center justify-center text-xs"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono">{zoom.toFixed(1)}x</span>
                    <button
                      onClick={() => setZoom(z => Math.min(3, z + 0.2))}
                      className="w-6 h-6 rounded bg-[var(--app-panel)] hover:bg-[var(--app-surface-hover)] flex items-center justify-center text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-[var(--app-accent)]"
                />
              </div>

              {/* Wallpaper specific controls */}
              {!isBanner && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--app-border)]">
                  {/* Dimming Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                      <span>Dim / Darkness:</span>
                      <span className="font-mono text-[11px]">{dim}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={dim}
                      onChange={(e) => setDim(parseInt(e.target.value, 10))}
                      className="w-full accent-[var(--app-accent)]"
                    />
                  </div>

                  {/* Blur Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                      <span>Blur Background:</span>
                      <span className="font-mono text-[11px]">{blur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={blur}
                      onChange={(e) => setBlur(parseInt(e.target.value, 10))}
                      className="w-full accent-[var(--app-accent)]"
                    />
                  </div>

                  {/* Glass Texture Checkbox */}
                  <div className="flex items-center justify-between sm:justify-center gap-2 pt-3 sm:pt-0">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--text-primary)] select-none">
                      <input
                        type="checkbox"
                        checked={texture}
                        onChange={(e) => setTexture(e.target.checked)}
                        className="rounded accent-[var(--app-accent)] w-4 h-4"
                      />
                      Retro Glass Texture
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="min-h-14 shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPanX(0);
              setPanY(0);
              setDim(30);
              setBlur(2);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)] flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Crop
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--app-surface-hover)]"
            >
              Cancel
            </button>
            <button
              disabled={!imageUrl}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold frutiger-btn frutiger-btn-primary text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <Check className="w-4 h-4" />
              Apply {isBanner ? 'Banner' : 'Wallpaper'}
            </button>
          </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
