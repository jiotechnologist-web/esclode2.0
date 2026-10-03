"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import {
  X, Loader2, Volume2, VolumeX, Maximize, Minimize, RotateCw,
  Smartphone, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveWatchProgress } from "./use-media-list";
import type { ApiMediaItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  items: ApiMediaItem[];
  startIndex: number;
  reelsMode?: boolean;
  onClose: () => void;
}

function formatTime(s: number): string {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const h = Math.floor(s / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function VideoPlayerOverlay({ items, startIndex, reelsMode: initialReelsMode = false, onClose }: Props) {
  const videoPrefs = useUIStore((s) => s.videoPrefs);
  const setVideoPrefs = useUIStore((s) => s.setVideoPrefs);
  const [index, setIndex] = useState(startIndex);
  const [reelsMode, setReelsMode] = useState(initialReelsMode || videoPrefs?.reelsEnabled || false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimerRef = useRef<any>(null);
  const lastTapRef = useRef(0);

  const media = items[index];
  const preloadAttr = videoPrefs?.preloadVideos ? "auto" : "metadata";

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) { document.exitFullscreen?.(); setFullscreen(false); }
        else onClose();
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key.toLowerCase() === "f") toggleFullscreen();
      else if (e.key.toLowerCase() === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Reset on index change
  useEffect(() => {
    setLoading(true);
    setTime(0);
    setDuration(0);
    setRotation(0);
  }, [index]);

  // Auto-hide controls
  const showControlsTemp = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (playing) {
      hideControlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  // Watch progress
  useEffect(() => {
    if (!media) return;
    const id = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        saveWatchProgress(media.id, videoRef.current.currentTime, videoRef.current.duration);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [media]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) videoRef.current.play();
    else videoRef.current.pause();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  };

  const seek = (t: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, t));
  };

  const skip = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current;
        if (el) {
          if (el.requestFullscreen) await el.requestFullscreen();
          else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
        }
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      } else {
        toast.error("Fullscreen not supported");
      }
    }
  };

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // Double-tap to seek
  const onAreaClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) skip(-10);
      else skip(10);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      togglePlay();
    }
  };

  // Reels swipe
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (reelsMode && Math.abs(dy) > 80) {
      if (dy < 0) next();
      else prev();
    }
    touchStartY.current = null;
  };

  const toggleReelsMode = () => {
    const newVal = !reelsMode;
    setReelsMode(newVal);
    if (setVideoPrefs && videoPrefs) {
      setVideoPrefs({ ...videoPrefs, reelsEnabled: newVal });
    }
    fetch("/api/user/nav-prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelsEnabled: newVal }),
    }).catch(() => {});
    toast.success(newVal ? "Reels mode enabled" : "Reels mode disabled");
  };

  if (!media) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center text-white">
        <p>Video not found</p>
        <Button variant="outline" onClick={onClose} className="ml-3 text-white">Close</Button>
      </div>
    );
  }

  // === REELS MODE (TikTok/Instagram style) ===
  if (reelsMode) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black z-50 select-none overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseMove={showControlsTemp}
      >
        {/* Full-screen video */}
        <div className="absolute inset-0 flex items-center justify-center">
          <video
            ref={videoRef}
            src={`/api/media/${media.id}/stream`}
            className="w-full h-full object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
            playsInline
            autoPlay
            loop
            preload={preloadAttr as any}
            poster={media.thumbnailUrl ?? undefined}
            onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setLoading(false); e.currentTarget.play(); }}
            onPlay={() => { setPlaying(true); showControlsTemp(); }}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onEnded={() => next()}
            crossOrigin="anonymous"
          />
        </div>

        {/* Gradient overlays for controls */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />

        {/* Top bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 inset-x-0 z-20 p-4 pt-safe flex items-center justify-between"
            >
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                <X className="w-6 h-6" />
              </Button>
              <div className="text-white text-sm font-medium truncate max-w-[50%]">{media.name}</div>
              <Button variant="ghost" size="icon" onClick={toggleReelsMode} className={cn("text-white hover:bg-white/10", reelsMode && "bg-emerald-500/30")} title="Switch to Standard">
                <Monitor className="w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right-side action rail */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-3 bottom-28 z-20 flex flex-col items-center gap-5"
            >
              <ReelsAction icon={playing ? X : Volume2} label={playing ? "Pause" : "Play"} onClick={togglePlay} />
              <ReelsAction icon={muted ? VolumeX : Volume2} label={muted ? "Unmute" : "Mute"} onClick={toggleMute} />
              <ReelsAction icon={RotateCw} label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)} />
              <ReelsAction icon={Maximize} label="Fullscreen" onClick={toggleFullscreen} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom progress + play */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 inset-x-0 z-20 p-4 pb-safe"
            >
              <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
                  {playing ? <X className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </Button>
                <div className="text-white text-xs font-mono">{formatTime(time)} / {formatTime(duration)}</div>
              </div>
              {/* Seek bar */}
              <div className="relative h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" style={{ width: `${(time / (duration || 1)) * 100}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // === STANDARD MODE ===
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 select-none flex flex-col"
      onMouseMove={showControlsTemp}
    >
      {/* Top bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 inset-x-0 z-20 p-4 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
              <div className="text-white text-sm font-medium truncate max-w-[50vw]">{media.name}</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/70 text-xs mr-2">{index + 1} / {items.length}</span>
              <Button variant="ghost" size="icon" onClick={toggleReelsMode} className={cn("text-white hover:bg-white/10", reelsMode && "bg-emerald-500/30")} title="Reels Mode">
                <Smartphone className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden" onClick={onAreaClick}>
        <video
          ref={videoRef}
          src={`/api/media/${media.id}/stream`}
          className="w-full h-full object-contain"
          style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.2s ease" }}
          playsInline
          preload={preloadAttr as any}
          poster={media.thumbnailUrl ?? undefined}
          onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setLoading(false); }}
          onPlay={() => { setPlaying(true); showControlsTemp(); }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onEnded={() => saveWatchProgress(media.id, videoRef.current?.duration ?? 0, videoRef.current?.duration)}
          crossOrigin="anonymous"
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}

        {!playing && !loading && (
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
              <Volume2 className="w-10 h-10 text-white" />
            </div>
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 inset-x-0 z-20 p-4 pb-safe bg-gradient-to-t from-black/80 to-transparent"
          >
            {/* Seek bar */}
            <div className="relative h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" style={{ width: `${(time / (duration || 1)) * 100}%` }} />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
                {playing ? <X className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="text-white hover:bg-white/10">
                <RotateCw className="w-5 h-5 rotate-180" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => skip(10)} className="text-white hover:bg-white/10">
                <RotateCw className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-1 ml-1">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/10">
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v); setMuted(v === 0);
                    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
                  }}
                  className="w-16 h-1 accent-white"
                />
              </div>
              <div className="text-white/80 text-xs font-mono ml-2">{formatTime(time)} / {formatTime(duration)}</div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={rate}
                  onChange={(e) => { const v = Number(e.target.value); setRate(v); if (videoRef.current) videoRef.current.playbackRate = v; }}
                  className="bg-white/10 text-white text-xs rounded px-2 py-1 border-0"
                >
                  <option value="0.5" className="text-black">0.5×</option>
                  <option value="0.75" className="text-black">0.75×</option>
                  <option value="1" className="text-black">1×</option>
                  <option value="1.25" className="text-black">1.25×</option>
                  <option value="1.5" className="text-black">1.5×</option>
                  <option value="2" className="text-black">2×</option>
                </select>
                <Button variant="ghost" size="icon" onClick={() => setRotation((r) => (r + 90) % 360)} className="text-white hover:bg-white/10" title="Rotate 90°">
                  <RotateCw className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleReelsMode} className={cn("text-white hover:bg-white/10", reelsMode && "bg-emerald-500/30")} title="Reels">
                  <Smartphone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10">
                  {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReelsAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-white"
    >
      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px]">{label}</span>
    </motion.button>
  );
}
