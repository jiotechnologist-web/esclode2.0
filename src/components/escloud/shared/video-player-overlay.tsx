"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { X, Loader2, ChevronUp, ChevronDown, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveWatchProgress } from "./use-media-list";
import type { ApiMediaItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

// Vidstack React imports (NEW player — replaces the old hand-rolled video player)
import { MediaPlayer, MediaProvider, Poster, Track } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import type { MediaPlayerInstance } from "@vidstack/react";

// Vidstack CSS — must be imported so the player UI (controls, menus, sliders) renders correctly
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface Props {
  items: ApiMediaItem[];
  startIndex: number;
  reelsMode?: boolean;
  onClose: () => void;
}

/**
 * ReelsFeed — TikTok / Instagram Reels style vertical feed.
 * Each video occupies the full viewport. CSS scroll-snap handles the swipe.
 * IntersectionObserver autoplays the visible video and pauses the others.
 * The next video is preloaded to minimize buffering.
 * Vidstack provides play/pause, seek, volume, speed, quality, subtitles, PiP, fullscreen.
 */
function ReelsFeed({ items, startIndex, onClose }: { items: ApiMediaItem[]; startIndex: number; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Player instances captured via ref-callbacks so the feed can control play/pause on scroll
  const playerRefs = useRef<Map<number, MediaPlayerInstance>>(new Map());
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [showChrome, setShowChrome] = useState(true);
  const hideChromeTimer = useRef<any>(null);

  // Initial scroll to startIndex
  useEffect(() => {
    const el = itemRefs.current[startIndex];
    if (el) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [startIndex]);

  // IntersectionObserver — autoplay active video, pause others
  useEffect(() => {
    const opts: IntersectionObserverInit = {
      root: containerRef.current,
      threshold: [0.6],
    };
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset.index);
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          setActiveIndex(idx);
          // Pause all other players
          playerRefs.current.forEach((p, i) => {
            if (i !== idx && p?.state?.playing) {
              try { p.remoteControl.pause(); } catch {}
            }
          });
          // Play this one (the user already performed a click gesture when opening the overlay,
          // so unmuted autoplay should be allowed by the browser)
          const p = playerRefs.current.get(idx);
          if (p && !p.state?.playing) {
            try { p.remoteControl.play(); } catch {}
          }
        } else {
          // Pause the one leaving the viewport
          const p = playerRefs.current.get(idx);
          if (p?.state?.playing) {
            try { p.remoteControl.pause(); } catch {}
          }
        }
      }
    }, opts);
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [items.length]);

  // Save watch progress when active video changes
  useEffect(() => {
    const active = items[activeIndex];
    if (!active) return;
    const id = setInterval(() => {
      const p = playerRefs.current.get(activeIndex);
      if (p && p.state?.playing) {
        saveWatchProgress(active.id, p.state.currentTime ?? 0, p.state.duration ?? undefined);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [activeIndex, items]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, onClose]);

  const scrollToIndex = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    const el = itemRefs.current[clamped];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [items.length]);

  // Auto-hide chrome (top bar / nav arrows) after inactivity
  const pokeChrome = () => {
    setShowChrome(true);
    if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
    hideChromeTimer.current = setTimeout(() => setShowChrome(false), 3000);
  };
  useEffect(() => {
    pokeChrome();
    return () => { if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current); };
  }, []);

  // Cleanup all players on unmount
  useEffect(() => {
    return () => {
      playerRefs.current.forEach((p) => {
        try { p?.destroy(); } catch {}
      });
      playerRefs.current.clear();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-y-auto no-scrollbar reels-feed"
      onMouseMove={pokeChrome}
      onTouchStart={pokeChrome}
    >
      <AnimatePresence>
        {showChrome && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 inset-x-0 z-50 p-3 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between pointer-events-none"
          >
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 pointer-events-auto">
              <X className="w-6 h-6" />
            </Button>
            <div className="text-white text-xs font-medium truncate max-w-[60%] pointer-events-auto">
              {items[activeIndex]?.name} · {activeIndex + 1}/{items.length}
            </div>
            <div className="w-10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Up/Down navigation arrows (desktop) */}
      <AnimatePresence>
        {showChrome && (
          <>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex >= items.length - 1}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 backdrop-blur flex items-center justify-center text-white"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex <= 0}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 backdrop-blur flex items-center justify-center text-white"
            >
              <ChevronUp className="w-5 h-5" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {items.map((m, i) => {
        // Preload strategy: mount active ± 1 fully; mount others lazily.
        const distance = Math.abs(i - activeIndex);
        const shouldPreload = distance <= 1;
        return (
          <div
            key={m.id}
            data-index={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="reels-item w-full flex items-center justify-center bg-black relative"
            style={{ height: "100dvh" }}
          >
            <ReelsVideoItem
              media={m}
              attachRef={(p) => {
                if (p) playerRefs.current.set(i, p);
                else playerRefs.current.delete(i);
              }}
              active={i === activeIndex}
              preload={shouldPreload ? "auto" : "metadata"}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * ReelsVideoItem — a single full-viewport Vidstack player.
 * Captures the player instance so the parent feed can control it (play/pause on scroll).
 */
function ReelsVideoItem({
  media,
  attachRef,
  active,
  preload,
}: {
  media: ApiMediaItem;
  attachRef: (p: MediaPlayerInstance | null) => void;
  active: boolean;
  preload: "auto" | "metadata" | "none";
}) {
  const [textTracks] = useState<any[]>([]); // Future: real VTT tracks via API
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative w-full h-full max-w-[100vw] max-h-[100dvh] flex items-center justify-center">
        <MediaPlayer
          className="media-player-reels"
          src={src}
          viewType="video"
          streamType="on-demand"
          logLevel="warn"
          crossOrigin
          playsInline
          autoPlay={active}
          preload={preload}
          title={media.name}
          poster={poster}
          ref={attachRef}
        >
          <MediaProvider>
            <Poster className="vds-poster" />
            {textTracks.map((t) => (
              <Track {...t} key={t.src} />
            ))}
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      </div>
    </div>
  );
}

/**
 * StandardPlayer — single-video Vidstack player (used when reelsMode is off).
 */
function StandardPlayer({ media, onClose }: { media: ApiMediaItem; onClose: () => void }) {
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;
  const [textTracks] = useState<any[]>([]);
  const playerRef = useRef<MediaPlayerInstance | null>(null);

  // Save watch progress periodically
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (p && p.state?.playing) {
        saveWatchProgress(media.id, p.state.currentTime ?? 0, p.state.duration ?? undefined);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [media.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-50 p-3 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3 pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
        <div className="text-white text-sm font-medium truncate flex-1">{media.name}</div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <MediaPlayer
          className="media-player-standard w-full h-full"
          src={src}
          viewType="video"
          streamType="on-demand"
          logLevel="warn"
          crossOrigin
          playsInline
          autoPlay
          preload="auto"
          title={media.name}
          poster={poster}
          ref={(p) => { playerRef.current = p; }}
        >
          <MediaProvider>
            <Poster className="vds-poster" />
            {textTracks.map((t) => (
              <Track {...t} key={t.src} />
            ))}
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      </div>
    </div>
  );
}

export function VideoPlayerOverlay({ items, startIndex, reelsMode: initialReelsMode = false, onClose }: Props) {
  const videoPrefs = useUIStore((s) => s.videoPrefs);
  const setVideoPrefs = useUIStore((s) => s.setVideoPrefs);
  const [reelsMode, setReelsMode] = useState(initialReelsMode || videoPrefs?.reelsEnabled || false);
  const [index, setIndex] = useState(startIndex);
  const media = items[index];

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
    toast.success(newVal ? "Reels mode enabled" : "Standard mode enabled");
  };

  if (!media) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center text-white">
        <p>Video not found</p>
        <Button variant="outline" onClick={onClose} className="ml-3 text-white">Close</Button>
      </div>
    );
  }

  if (reelsMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <ReelsFeed items={items} startIndex={startIndex} onClose={onClose} />
        {/* Mode toggle floating in corner */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleReelsMode}
          className="fixed top-3 right-3 z-[60] text-white hover:bg-white/10 bg-black/30 backdrop-blur"
          title="Switch to Standard mode"
        >
          <Monitor className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <StandardPlayer media={media} onClose={onClose} />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleReelsMode}
        className="fixed top-3 right-3 z-[60] text-white hover:bg-white/10 bg-black/30 backdrop-blur"
        title="Switch to Reels mode"
      >
        <Smartphone className="w-5 h-5" />
      </Button>
      {/* Index navigation for standard mode */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
        <Button
          variant="ghost"
          size="sm"
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="text-white hover:bg-white/10 disabled:opacity-30 h-8 px-2"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <span className="text-white text-xs">{index + 1} / {items.length}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={index >= items.length - 1}
          onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          className="text-white hover:bg-white/10 disabled:opacity-30 h-8 px-2"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
