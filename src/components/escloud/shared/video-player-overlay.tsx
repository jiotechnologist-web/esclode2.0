"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { X, ChevronUp, ChevronDown, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
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
 *
 * Each video occupies the full viewport. CSS scroll-snap handles the swipe.
 * IntersectionObserver notifies items when they become active. Each item
 * manages its own playback based on the `active` prop (this avoids the
 * "this.$state[prop] is not a function" error that occurs when an external
 * component tries to call methods on a player instance whose internal
 * signal store has been disposed or not yet initialized).
 */
function ReelsFeed({ items, startIndex, onClose }: { items: ApiMediaItem[]; startIndex: number; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
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

  // IntersectionObserver — just track which item is active.
  // Each item handles its own play/pause based on the `active` prop.
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
        }
      }
    }, opts);
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [items.length]);

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
 *
 * Self-contained: it manages its own playback based on the `active` prop.
 * It calls `player.play()` only after `onCanPlay` fires, and `player.pause()`
 * when `active` becomes false. All player method calls are wrapped in try/catch
 * to avoid leaking internal Vidstack signal errors when the underlying instance
 * is being disposed or not yet ready.
 */
function ReelsVideoItem({
  media,
  active,
  preload,
}: {
  media: ApiMediaItem;
  active: boolean;
  preload: "auto" | "metadata" | "none";
}) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const [textTracks] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;

  // Track playback time for watch-progress persistence
  const lastSavedRef = useRef(0);

  // When `active` changes, play or pause accordingly.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    // Use a small delay to let the player finish any internal state transitions
    const t = setTimeout(() => {
      try {
        if (active && ready) {
          p.remoteControl.play();
        } else if (!active) {
          p.remoteControl.pause();
        }
      } catch {
        // Ignore — player may not be ready yet
      }
    }, 50);
    return () => clearTimeout(t);
  }, [active, ready]);

  // Periodically save watch progress while this video is the active one
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        // Use the player's internal state via the public method (avoids signal
        // subscription errors). The MediaPlayerInstance exposes `state` as a
        // getter that returns the current snapshot.
        const state = p.state;
        if (state?.playing) {
          const pos = state.currentTime ?? 0;
          if (Math.abs(pos - lastSavedRef.current) >= 5) {
            lastSavedRef.current = pos;
            saveWatchProgress(media.id, pos, state.duration ?? undefined);
          }
        }
      } catch {
        // Ignore — state may not be available yet
      }
    }, 10000);
    return () => clearInterval(id);
  }, [active, media.id]);

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
          preload={preload}
          title={media.name}
          poster={poster}
          ref={(p) => { playerRef.current = p; }}
          onCanPlay={() => {
            setReady(true);
            // If this item is already active by the time can-play fires, start playing
            if (active) {
              try { playerRef.current?.remoteControl.play(); } catch {}
            }
          }}
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
  const lastSavedRef = useRef(0);

  // Save watch progress periodically
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const state = p.state;
        if (state?.playing) {
          const pos = state.currentTime ?? 0;
          if (Math.abs(pos - lastSavedRef.current) >= 5) {
            lastSavedRef.current = pos;
            saveWatchProgress(media.id, pos, state.duration ?? undefined);
          }
        }
      } catch {
        // Ignore
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
