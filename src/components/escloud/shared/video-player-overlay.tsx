"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { X, ChevronUp, ChevronDown, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { saveWatchProgress } from "./use-media-list";
import type { ApiMediaItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  items: ApiMediaItem[];
  startIndex: number;
  reelsMode?: boolean;
  onClose: () => void;
}

function formatTime(time: number): string {
  if (!isFinite(time) || time < 0) return "00:00";
  let seconds = Math.floor(time % 60);
  let minutes = Math.floor(time / 60) % 60;
  let hours = Math.floor(time / 3600);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours === 0) return `${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * CustomVideoPlayer — a single video player based on Chirag047's Video-Player
 * design (https://github.com/Chirag047/Video-Player). Vanilla DOM video element
 * with custom controls (timeline, play/pause, skip, volume, speed, PiP, fullscreen).
 *
 * Refactored as a React component, but the structure / styling / behavior matches
 * the original repo.
 */
function CustomVideoPlayer({
  src,
  poster,
  title,
  autoPlay = false,
  preload = "metadata",
  onProgress,
  onEnded,
  active,
}: {
  src: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  preload?: "auto" | "metadata" | "none";
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  active?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTimeRef = useRef<HTMLSpanElement>(null);
  const currentTimeRef = useRef<HTMLParagraphElement>(null);
  const videoDurationRef = useRef<HTMLParagraphElement>(null);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);
  const volumeBtnIconRef = useRef<HTMLElement>(null);
  const volumeSliderRef = useRef<HTMLInputElement>(null);
  const playPauseBtnIconRef = useRef<HTMLElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const speedOptionsRef = useRef<HTMLUListElement>(null);
  const fullScreenBtnIconRef = useRef<HTMLElement>(null);
  const hideTimerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-hide controls when playing
  const hideControls = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      containerRef.current?.classList.remove("show-controls");
    }, 3000);
  }, []);

  const showControls = useCallback(() => {
    containerRef.current?.classList.add("show-controls");
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideControls();
  }, [hideControls]);

  // Wire up events on mount
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const timeline = timelineRef.current;
    const progressBar = progressBarRef.current;
    const progressTime = progressTimeRef.current;
    const currentTimeEl = currentTimeRef.current;
    const videoDurationEl = videoDurationRef.current;
    const volumeBtnIcon = volumeBtnIconRef.current;
    const volumeSlider = volumeSliderRef.current;
    const playPauseIcon = playPauseBtnIconRef.current;
    const speedOptions = speedOptionsRef.current;
    const fullScreenIcon = fullScreenBtnIconRef.current;
    if (!container || !video || !timeline || !progressBar || !volumeBtnIcon || !volumeSlider || !playPauseIcon || !speedOptions || !fullScreenIcon) return;

    const onTimeUpdate = () => {
      const { currentTime, duration } = video;
      if (duration > 0) {
        const percent = (currentTime / duration) * 100;
        progressBar.style.width = `${percent}%`;
      }
      if (currentTimeEl) currentTimeEl.innerText = formatTime(currentTime);
      onProgress?.(currentTime, duration);
    };

    const onLoadedData = () => {
      if (videoDurationEl) videoDurationEl.innerText = formatTime(video.duration);
    };

    const onPlay = () => {
      playPauseIcon.classList.remove("fa-play");
      playPauseIcon.classList.add("fa-pause");
      hideControls();
    };
    const onPause = () => {
      playPauseIcon.classList.remove("fa-pause");
      playPauseIcon.classList.add("fa-play");
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      container.classList.add("show-controls");
    };
    const onEndedHandler = () => { onEnded?.(); };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEndedHandler);

    const onTimelineMouseMove = (e: MouseEvent) => {
      const timelineWidth = timeline.clientWidth;
      let offsetX = e.offsetX;
      const percent = Math.floor((offsetX / timelineWidth) * (video.duration || 0));
      if (progressTime) {
        offsetX = offsetX < 20 ? 20 : offsetX > timelineWidth - 20 ? timelineWidth - 20 : offsetX;
        progressTime.style.left = `${offsetX}px`;
        progressTime.innerText = formatTime(percent);
      }
    };
    const onTimelineClick = (e: MouseEvent) => {
      const timelineWidth = timeline.clientWidth;
      video.currentTime = (e.offsetX / timelineWidth) * (video.duration || 0);
    };
    let isDragging = false;
    const onTimelineMousedown = () => {
      isDragging = true;
      timeline.addEventListener("mousemove", onTimelineDrag);
    };
    const onTimelineDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      const timelineWidth = timeline.clientWidth;
      let x = e.offsetX;
      if (x < 0) x = 0;
      if (x > timelineWidth) x = timelineWidth;
      progressBar.style.width = `${x}px`;
      video.currentTime = (x / timelineWidth) * (video.duration || 0);
      if (currentTimeEl) currentTimeEl.innerText = formatTime(video.currentTime);
    };
    const onTimelineMouseup = () => {
      isDragging = false;
      timeline.removeEventListener("mousemove", onTimelineDrag);
    };
    timeline.addEventListener("mousemove", onTimelineMouseMove);
    timeline.addEventListener("click", onTimelineClick);
    timeline.addEventListener("mousedown", onTimelineMousedown);
    document.addEventListener("mouseup", onTimelineMouseup);

    const onContainerMousemove = () => showControls();
    container.addEventListener("mousemove", onContainerMousemove);

    // Volume
    const onVolumeBtnClick = () => {
      if (!volumeBtnIcon.classList.contains("fa-volume-high")) {
        video.volume = 0.5;
        volumeBtnIcon.classList.remove("fa-volume-xmark");
        volumeBtnIcon.classList.add("fa-volume-high");
      } else {
        video.volume = 0.0;
        volumeBtnIcon.classList.remove("fa-volume-high");
        volumeBtnIcon.classList.add("fa-volume-xmark");
      }
      if (volumeSlider) volumeSlider.value = String(video.volume);
    };
    volumeBtnRef.current?.addEventListener("click", onVolumeBtnClick);

    const onVolumeInput = (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      video.volume = v;
      if (v === 0) {
        volumeBtnIcon.classList.remove("fa-volume-high");
        volumeBtnIcon.classList.add("fa-volume-xmark");
      } else {
        volumeBtnIcon.classList.remove("fa-volume-xmark");
        volumeBtnIcon.classList.add("fa-volume-high");
      }
    };
    volumeSlider?.addEventListener("input", onVolumeInput);

    // Speed
    const onSpeedOptionClick = (e: Event) => {
      const li = e.target as HTMLLIElement;
      const speed = li.dataset.speed;
      if (!speed) return;
      video.playbackRate = Number(speed);
      const active = speedOptions.querySelector(".active");
      if (active) active.classList.remove("active");
      li.classList.add("active");
    };
    speedOptions.querySelectorAll("li").forEach((li) => li.addEventListener("click", onSpeedOptionClick));

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "SPAN" || !target.classList.contains("material-symbols-rounded")) {
        speedOptions.classList.remove("show");
      }
    };
    document.addEventListener("click", onDocClick);

    const onSpeedBtnClick = () => speedOptions.classList.toggle("show");
    speedBtnRef.current?.addEventListener("click", onSpeedBtnClick);

    // Fullscreen
    const onFullscreenChange = () => {
      const fsEl = document.fullscreenElement;
      setIsFullscreen(!!fsEl);
      if (fsEl) {
        fullScreenIcon.classList.remove("fa-expand");
        fullScreenIcon.classList.add("fa-compress");
      } else {
        fullScreenIcon.classList.remove("fa-compress");
        fullScreenIcon.classList.add("fa-expand");
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEndedHandler);
      timeline.removeEventListener("mousemove", onTimelineMouseMove);
      timeline.removeEventListener("click", onTimelineClick);
      timeline.removeEventListener("mousedown", onTimelineMousedown);
      document.removeEventListener("mouseup", onTimelineMouseup);
      container.removeEventListener("mousemove", onContainerMousemove);
      volumeBtnRef.current?.removeEventListener("click", onVolumeBtnClick);
      volumeSlider?.removeEventListener("input", onVolumeInput);
      speedOptions.querySelectorAll("li").forEach((li) => li.removeEventListener("click", onSpeedOptionClick));
      document.removeEventListener("click", onDocClick);
      speedBtnRef.current?.removeEventListener("click", onSpeedBtnClick);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [src, onProgress, onEnded, hideControls, showControls]);

  // Controls handlers (defined as React event handlers using refs)
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const skipBackward = () => {
    const v = videoRef.current;
    if (v) v.currentTime -= 5;
  };
  const skipForward = () => {
    const v = videoRef.current;
    if (v) v.currentTime += 5;
  };
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => toast.error("Fullscreen not supported"));
    }
  };
  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      // @ts-ignore
      if (document.pictureInPictureElement) {
        // @ts-ignore
        await document.exitPictureInPicture();
      } else {
        // @ts-ignore
        await v.requestPictureInPicture();
      }
    } catch {
      toast.error("PiP not supported");
    }
  };

  // Autoplay when `active` becomes true
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && autoPlay) {
      // Try to play; if blocked by browser, stay paused (user gesture needed)
      v.play().catch(() => {});
    } else if (!active) {
      v.pause();
    }
  }, [active, autoPlay]);

  return (
    <div className="cvp-container show-controls" ref={containerRef}>
      <div className="cvp-wrapper">
        <div className="cvp-video-timeline" ref={timelineRef}>
          <div className="cvp-progress-area">
            <span ref={progressTimeRef}>00:00</span>
            <div className="cvp-progress-bar" ref={progressBarRef} />
          </div>
        </div>
        <ul className="cvp-video-controls">
          <li className="cvp-options left">
            <button className="cvp-volume" ref={volumeBtnRef} title="Mute / Unmute">
              <i ref={volumeBtnIconRef} className="fa-solid fa-volume-high" />
            </button>
            <input type="range" min={0} max={1} step={0.01} defaultValue={1} ref={volumeSliderRef} />
            <div className="cvp-video-timer">
              <p className="cvp-current-time" ref={currentTimeRef}>00:00</p>
              <p className="cvp-separator"> / </p>
              <p className="cvp-video-duration" ref={videoDurationRef}>00:00</p>
            </div>
          </li>
          <li className="cvp-options center">
            <button className="cvp-skip-backward" onClick={skipBackward} title="Back 5s">
              <i className="fas fa-backward" />
            </button>
            <button className="cvp-play-pause" onClick={togglePlay} title="Play / Pause">
              <i ref={playPauseBtnIconRef} className="fas fa-play" />
            </button>
            <button className="cvp-skip-forward" onClick={skipForward} title="Forward 5s">
              <i className="fas fa-forward" />
            </button>
          </li>
          <li className="cvp-options right">
            <div className="cvp-playback-content">
              <button className="cvp-playback-speed" ref={speedBtnRef} title="Playback speed">
                <span className="material-symbols-rounded">slow_motion_video</span>
              </button>
              <ul className="cvp-speed-options" ref={speedOptionsRef}>
                <li data-speed="2">2x</li>
                <li data-speed="1.5">1.5x</li>
                <li data-speed="1" className="active">Normal</li>
                <li data-speed="0.75">0.75x</li>
                <li data-speed="0.5">0.5x</li>
              </ul>
            </div>
            <button className="cvp-pic-in-pic" onClick={togglePiP} title="Picture in Picture">
              <span className="material-icons">picture_in_picture_alt</span>
            </button>
            <button className="cvp-fullscreen" onClick={toggleFullscreen} title="Fullscreen">
              <i ref={fullScreenBtnIconRef} className="fa-solid fa-expand" />
            </button>
          </li>
        </ul>
      </div>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload={preload as any}
        crossOrigin="anonymous"
        className="cvp-video"
      />
    </div>
  );
}

/**
 * ReelsFeed — vertical scroll-snap feed (TikTok/Instagram style).
 * Each video occupies the full viewport. IntersectionObserver autoplays the
 * active video and pauses the others. Next video is preloaded.
 */
function ReelsFeed({ items, startIndex, onClose }: { items: ApiMediaItem[]; startIndex: number; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [showChrome, setShowChrome] = useState(true);
  const hideChromeTimer = useRef<any>(null);

  // Initial scroll
  useEffect(() => {
    const el = itemRefs.current[startIndex];
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
  }, [startIndex]);

  // IntersectionObserver — track which item is active
  useEffect(() => {
    const opts: IntersectionObserverInit = { root: containerRef.current, threshold: [0.6] };
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset.index);
        if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiveIndex(idx);
      }
    }, opts);
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [items.length]);

  // Keyboard nav
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

function ReelsVideoItem({
  media,
  active,
  preload,
}: {
  media: ApiMediaItem;
  active: boolean;
  preload: "auto" | "metadata" | "none";
}) {
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;
  const lastSavedRef = useRef(0);

  const onProgress = useCallback((currentTime: number, duration: number) => {
    if (Math.abs(currentTime - lastSavedRef.current) >= 5) {
      lastSavedRef.current = currentTime;
      saveWatchProgress(media.id, currentTime, duration || undefined);
    }
  }, [media.id]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative w-full h-full max-w-[100vw] max-h-[100dvh] flex items-center justify-center cvp-reels-item">
        <CustomVideoPlayer
          src={src}
          poster={poster}
          title={media.name}
          autoPlay={active}
          preload={preload}
          active={active}
          onProgress={onProgress}
        />
      </div>
    </div>
  );
}

function StandardPlayer({ media, onClose }: { media: ApiMediaItem; onClose: () => void }) {
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;
  const lastSavedRef = useRef(0);

  const onProgress = useCallback((currentTime: number, duration: number) => {
    if (Math.abs(currentTime - lastSavedRef.current) >= 5) {
      lastSavedRef.current = currentTime;
      saveWatchProgress(media.id, currentTime, duration || undefined);
    }
  }, [media.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 inset-x-0 z-50 p-3 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3 pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
        <div className="text-white text-sm font-medium truncate flex-1">{media.name}</div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="cvp-standard-wrap">
          <CustomVideoPlayer
            src={src}
            poster={poster}
            title={media.name}
            autoPlay
            preload="auto"
            active
            onProgress={onProgress}
          />
        </div>
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
