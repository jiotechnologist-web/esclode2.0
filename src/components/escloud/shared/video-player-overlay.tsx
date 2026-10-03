"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { X, ChevronUp, ChevronDown, Smartphone, Monitor, SkipBack, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { saveWatchProgress } from "./use-media-list";
import type { ApiMediaItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

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
 * SeekFeedback — visual ripple shown when double-tap-to-seek is triggered.
 */
function SeekFeedback({
  side,
  amount,
  counter,
}: {
  side: "left" | "right";
  amount: number;
  counter: number;
}) {
  return (
    <motion.div
      key={counter}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18 }}
      className={`cvp-seek-feedback cvp-seek-feedback-${side}`}
    >
      <div className="cvp-seek-feedback-icon">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="white" strokeWidth="2">
          {side === "left" ? (
            <path d="M11 5l-7 7 7 7M4 12h13" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M13 5l7 7-7 7M20 12H7" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>
      <div className="cvp-seek-feedback-text">{amount}s</div>
    </motion.div>
  );
}

/**
 * VolumeBrightnessOverlay — visual indicator for swipe-up volume / brightness control.
 */
function VolumeBrightnessOverlay({
  side,
  value,
  visible,
}: {
  side: "left" | "right";
  value: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const label = side === "left" ? "Brightness" : "Volume";
  const icon =
    side === "left" ? (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
        <path d="M3 10v4h4l5 5V5L7 10H3z" />
        <path d="M16 8a5 5 0 0 1 0 8" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>
    );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`cvp-vb-overlay cvp-vb-overlay-${side}`}
    >
      <div className="cvp-vb-icon">{icon}</div>
      <div className="cvp-vb-bar">
        <div className="cvp-vb-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
      <div className="cvp-vb-label">{label}</div>
    </motion.div>
  );
}

/**
 * CustomVideoPlayer — based on Chirag047 Video-Player design with:
 *  + YouTube-style double-tap to seek (left = −5s, right = +5s)
 *  + YouTube-style swipe up on left half = brightness, right half = volume
 *  + Standard controls: play/pause, skip ±5s, volume, speed menu (2x/1.5x/Normal/0.75/0.5), PiP, fullscreen
 *  + Timeline hover preview + draggable progress bar
 *  + Auto-hide controls when playing
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
  reelsMode = false,
}: {
  src: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  preload?: "auto" | "metadata" | "none";
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  active?: boolean;
  reelsMode?: boolean;
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const seekFeedbacksRef = useRef<{ left: { amount: number; counter: number } | null; right: { amount: number; counter: number } | null }>({
    left: null,
    right: null,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekFeedbacks, setSeekFeedbacks] = useState<React.ReactNode[]>([]);
  const [vbSide, setVbSide] = useState<"left" | "right" | null>(null);
  const [vbValue, setVbValue] = useState(0.5);
  const [vbVisible, setVbVisible] = useState(false);

  // Brightness is component-local state; the user can swipe up on the left half to brighten,
  // down to dim. Stored as 0.2–1.0. Applied to the <video> via CSS filter.
  const brightnessRef = useRef(1.0);
  const [brightness, setBrightness] = useState(1.0);

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

    // Timeline hover preview + click seek + drag
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

    // Show controls on mousemove
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

  // When src changes (new video), explicitly call load() to ensure the video reloads.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (active && autoPlay) {
      v.play().catch(() => {});
    }
  }, [src]);

  // Autoplay when `active` becomes true
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && autoPlay) {
      v.play().catch(() => {});
    } else if (!active) {
      v.pause();
    }
  }, [active, autoPlay]);

  // Apply brightness to the video element
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.style.filter = `brightness(${brightness})`;
  }, [brightness]);

  // ---------- YouTube-style double-tap to seek ----------
  // On the desktop: double-click on left half = −5s, right half = +5s.
  // On mobile: double-tap (touchstart) on left/right half = same.
  // Each successive double-tap adds 5s (10s, 15s, 20s...) and shows stacked feedback.
  const lastTapRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const tapStreakRef = useRef<{ left: number; right: number; timeout: any }>({
    left: 0,
    right: 0,
    timeout: null as any,
  });

  const triggerSeekFeedback = useCallback((side: "left" | "right", amount: number) => {
    setSeekFeedbacks((prev) => {
      const next = [...prev];
      const id = `${side}-${Date.now()}-${Math.random()}`;
      next.push(
        <div key={id} className="cvp-feedback-wrap">
          <SeekFeedback side={side} amount={amount} counter={next.length} />
        </div>
      );
      // Auto-remove after 700ms
      setTimeout(() => {
        setSeekFeedbacks((p) => p.filter((n) => (n as any).key !== id));
      }, 700);
      return next;
    });
  }, []);

  const handleDoubleTapSeek = useCallback(
    (side: "left" | "right") => {
      const v = videoRef.current;
      if (!v) return;
      const now = Date.now();
      const delta = now - lastTapRef.current[side];
      if (delta < 350) {
        // Within double-tap window — increment streak
        tapStreakRef.current[side] += 1;
        if (tapStreakRef.current.timeout) clearTimeout(tapStreakRef.current.timeout);
        tapStreakRef.current.timeout = setTimeout(() => {
          tapStreakRef.current[side] = 0;
        }, 800);
      } else {
        tapStreakRef.current[side] = 1;
        if (tapStreakRef.current.timeout) clearTimeout(tapStreakRef.current.timeout);
        tapStreakRef.current.timeout = setTimeout(() => {
          tapStreakRef.current[side] = 0;
        }, 800);
      }
      lastTapRef.current[side] = now;
      const streak = tapStreakRef.current[side];
      const amount = 5 * streak; // 5s, 10s, 15s, ...
      if (side === "left") {
        v.currentTime = Math.max(0, v.currentTime - 5);
        // For stacked display, show the cumulative amount
        triggerSeekFeedback("left", amount);
      } else {
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
        triggerSeekFeedback("right", amount);
      }
      // Show controls
      showControls();
    },
    [showControls, triggerSeekFeedback]
  );

  // Click on the video area: detect left/right half. Single click toggles play.
  // Double-click triggers seek. We use onClick + a custom double-tap detection.
  const onVideoAreaClick = (e: React.MouseEvent) => {
    // Detect if this is a double-click by time delta from last click
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const half = x < rect.width / 2 ? "left" : "right";
    handleDoubleTapSeekWithPlayToggle(half);
  };

  const lastSingleClickRef = useRef(0);
  const pendingSingleClickTimerRef = useRef<any>(null);
  const handleDoubleTapSeekWithPlayToggle = (side: "left" | "right") => {
    const now = Date.now();
    const delta = now - lastSingleClickRef.current;
    if (delta < 280) {
      // Double-click — cancel the pending single-click play toggle and do seek
      if (pendingSingleClickTimerRef.current) {
        clearTimeout(pendingSingleClickTimerRef.current);
        pendingSingleClickTimerRef.current = null;
      }
      handleDoubleTapSeek(side);
      lastSingleClickRef.current = 0;
    } else {
      // Pending single click — wait to see if it's a double-click
      lastSingleClickRef.current = now;
      pendingSingleClickTimerRef.current = setTimeout(() => {
        togglePlay();
        pendingSingleClickTimerRef.current = null;
      }, 280);
    }
  };

  // Touch handling for mobile double-tap-to-seek
  const lastTouchRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const touchStreakRef = useRef<{ left: number; right: number; timeout: any }>({
    left: 0,
    right: 0,
    timeout: null as any,
  });
  const onTouchEndArea = (e: React.TouchEvent) => {
    // 1. End volume/brightness swipe (if active)
    const wasVBSwipe = vbActiveRef.current;
    touchStartYRef.current = null;
    if (wasVBSwipe) {
      // Hide the overlay after a short delay
      setTimeout(() => setVbVisible(false), 300);
      vbActiveRef.current = null;
      setVbSide(null);
    }
    // 2. Handle double-tap-to-seek / single-tap play toggle
    //    BUT only if this was a TAP, not a swipe. A swipe has movement > 10px.
    if (e.changedTouches.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const endX = e.changedTouches[0].clientX - rect.left;
    const endY = e.changedTouches[0].clientY - rect.top;
    // Check if this was a swipe (significant movement from start position)
    // touchStartYRef was set by onTouchStartArea; if null, we can't determine — treat as tap
    if (touchStartPosRef.current) {
      const dx = endX - touchStartPosRef.current.x;
      const dy = endY - touchStartPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStartPosRef.current = null;
      if (dist > 12) {
        // It was a swipe (scroll or VB gesture), not a tap — skip tap handling
        return;
      }
    }
    // If a VB swipe was active, also skip tap handling
    if (wasVBSwipe) return;
    // It's a tap — handle double-tap-to-seek or single-tap play toggle
    const side = endX < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    const delta = now - lastTouchRef.current[side];
    if (delta < 300) {
      // Double-tap
      touchStreakRef.current[side] += 1;
      if (touchStreakRef.current.timeout) clearTimeout(touchStreakRef.current.timeout);
      touchStreakRef.current.timeout = setTimeout(() => {
        touchStreakRef.current[side] = 0;
      }, 800);
      const streak = touchStreakRef.current[side];
      const amount = 5 * streak;
      const v = videoRef.current;
      if (v) {
        if (side === "left") {
          v.currentTime = Math.max(0, v.currentTime - 5);
          triggerSeekFeedback("left", amount);
        } else {
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
          triggerSeekFeedback("right", amount);
        }
      }
      lastTouchRef.current[side] = now;
    } else {
      // Single tap — toggle play after a short delay (in case double-tap is coming)
      touchStreakRef.current[side] = 0;
      lastTouchRef.current[side] = now;
      if (touchStreakRef.current.timeout) clearTimeout(touchStreakRef.current.timeout);
      touchStreakRef.current.timeout = setTimeout(() => {
        // Single tap → toggle play
        togglePlay();
      }, 300);
    }
  };

  // ---------- YouTube-style swipe-up volume (right) / brightness (left) ----------
  // On touch: track start Y. On touchmove, compute delta Y. If the swipe started on the
  // left half of the video, adjust brightness. If on the right half, adjust volume.
  // Show an overlay with a vertical bar.
  const touchStartYRef = useRef<{ y: number; x: number; time: number } | null>(null);
  // Records the touch start position for tap-vs-swipe detection in onTouchEndArea.
  // Without this, a vertical scroll-swipe in reels mode would be misinterpreted as a tap
  // and toggle play/pause.
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const vbActiveRef = useRef<"left" | "right" | null>(null);
  const onTouchStartArea = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    touchStartYRef.current = { y, x, time: Date.now() };
    touchStartPosRef.current = { x, y };
  };
  const onTouchMoveArea = (e: React.TouchEvent) => {
    if (!touchStartYRef.current || e.touches.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = touchStartYRef.current.x;
    const startY = touchStartYRef.current.y;
    const curY = e.touches[0].clientY - rect.top;
    const dy = startY - curY; // up = positive
    // Need to move at least 12px to engage volume/brightness mode
    if (Math.abs(dy) < 12 && !vbActiveRef.current) return;
    if (!vbActiveRef.current) {
      // Determine side based on startX
      const side = startX < rect.width / 2 ? "left" : "right";
      vbActiveRef.current = side;
      setVbSide(side);
      setVbVisible(true);
    }
    // Vertical swipe distance → value (0..1). 200px = full range.
    const range = rect.height * 0.7;
    const delta = Math.max(-range, Math.min(range, dy));
    const value = delta / range; // -1..1
    // Add to current value (0..1)
    if (vbActiveRef.current === "left") {
      const base = brightnessRef.current;
      const newValue = Math.max(0.2, Math.min(1, base + value * 0.05));
      // Apply incrementally
      const incr = (dy / range) * 0.05;
      const final = Math.max(0.2, Math.min(1, brightnessRef.current + incr));
      brightnessRef.current = final;
      setBrightness(final);
      setVbValue(final);
    } else {
      const v = videoRef.current;
      if (v) {
        const incr = (dy / range) * 0.05;
        const final = Math.max(0, Math.min(1, v.volume + incr));
        v.volume = final;
        if (volumeSliderRef.current) volumeSliderRef.current.value = String(final);
        setVbValue(final);
        // Update volume icon
        if (volumeBtnIconRef.current) {
          if (final === 0) {
            volumeBtnIconRef.current.classList.remove("fa-volume-high");
            volumeBtnIconRef.current.classList.add("fa-volume-xmark");
          } else {
            volumeBtnIconRef.current.classList.remove("fa-volume-xmark");
            volumeBtnIconRef.current.classList.add("fa-volume-high");
          }
        }
      }
    }
    // Reset startY so each frame is incremental
    touchStartYRef.current.y = curY;
  };

  // ---------- Mouse wheel for desktop volume/brightness ----------
  // Hover the left half → wheel adjusts brightness. Right half → volume.
  const onMouseWheelArea = (e: React.WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? "left" : "right";
    const delta = -e.deltaY * 0.001; // up = +
    if (side === "left") {
      const final = Math.max(0.2, Math.min(1, brightnessRef.current + delta));
      brightnessRef.current = final;
      setBrightness(final);
      setVbSide("left");
      setVbValue(final);
      setVbVisible(true);
      setTimeout(() => setVbVisible(false), 700);
    } else {
      const v = videoRef.current;
      if (v) {
        const final = Math.max(0, Math.min(1, v.volume + delta));
        v.volume = final;
        if (volumeSliderRef.current) volumeSliderRef.current.value = String(final);
        setVbSide("right");
        setVbValue(final);
        setVbVisible(true);
        setTimeout(() => setVbVisible(false), 700);
      }
    }
  };

  // Controls handlers
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

  return (
    <div
      className="cvp-container show-controls"
      ref={containerRef}
      onClick={onVideoAreaClick}
      onTouchStart={onTouchStartArea}
      onTouchEnd={onTouchEndArea}
      {...(reelsMode ? {} : {
        onTouchMove: onTouchMoveArea,
        onWheel: onMouseWheelArea,
      })}
    >
      <div className="cvp-wrapper">
        <div className="cvp-video-timeline" ref={timelineRef}>
          <div className="cvp-progress-area">
            <span ref={progressTimeRef}>00:00</span>
            <div className="cvp-progress-bar" ref={progressBarRef} />
          </div>
        </div>
        <ul className="cvp-video-controls" onClick={(e) => e.stopPropagation()}>
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

      {/* Double-tap-to-seek feedback zones (left/right halves) */}
      <div className="cvp-feedback-container">
        {seekFeedbacks}
      </div>

      {/* Volume / Brightness overlay */}
      {vbSide && <VolumeBrightnessOverlay side={vbSide} value={vbValue} visible={vbVisible} />}
    </div>
  );
}

/**
 * ReelsFeed — TikTok / Instagram style vertical scroll-snap feed.
 * Each video occupies the full viewport (100dvh). Vertical swipe/scroll
 * snaps to the next/previous video. Active video autoplays, others pause.
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

  const scrollToIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      const el = itemRefs.current[clamped];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [items.length]
  );

  const pokeChrome = () => {
    setShowChrome(true);
    if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
    hideChromeTimer.current = setTimeout(() => setShowChrome(false), 3000);
  };
  useEffect(() => {
    pokeChrome();
    return () => {
      if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="cvp-reels-feed"
      onMouseMove={pokeChrome}
      onTouchStart={pokeChrome}
    >
      {/* Top chrome bar */}
      <AnimatePresence>
        {showChrome && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="cvp-reels-topbar"
          >
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="w-6 h-6" />
            </Button>
            <div className="cvp-reels-title">
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
              onClick={(e) => { e.stopPropagation(); scrollToIndex(activeIndex + 1); }}
              disabled={activeIndex >= items.length - 1}
              className="cvp-reels-nav cvp-reels-nav-down"
              title="Next video"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={(e) => { e.stopPropagation(); scrollToIndex(activeIndex - 1); }}
              disabled={activeIndex <= 0}
              className="cvp-reels-nav cvp-reels-nav-up"
              title="Previous video"
            >
              <ChevronUp className="w-5 h-5" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Reels items — each one is 100dvh and snaps to top */}
      {items.map((m, i) => {
        const distance = Math.abs(i - activeIndex);
        const shouldPreload = distance <= 1;
        return (
          <div
            key={m.id}
            data-index={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="cvp-reels-item"
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

  const onProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (Math.abs(currentTime - lastSavedRef.current) >= 5) {
        lastSavedRef.current = currentTime;
        saveWatchProgress(media.id, currentTime, duration || undefined);
      }
    },
    [media.id]
  );

  return (
    <div className="cvp-reels-item-inner">
      <CustomVideoPlayer
        src={src}
        poster={poster}
        title={media.name}
        autoPlay={active}
        preload={preload}
        active={active}
        onProgress={onProgress}
        reelsMode
      />
    </div>
  );
}

function StandardPlayer({
  media,
  onClose,
  onPrev,
  onNext,
  index,
  total,
}: {
  media: ApiMediaItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  index: number;
  total: number;
}) {
  const src = `/api/media/${media.id}/stream`;
  const poster = media.thumbnailUrl ?? undefined;
  const lastSavedRef = useRef(0);

  const onProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (Math.abs(currentTime - lastSavedRef.current) >= 5) {
        lastSavedRef.current = currentTime;
        saveWatchProgress(media.id, currentTime, duration || undefined);
      }
    },
    [media.id]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-0 inset-x-0 z-50 p-3 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center gap-3 pointer-events-auto">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
        <div className="text-white text-sm font-medium truncate flex-1">{media.name}</div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {/* key forces remount when media.id changes so the new video reloads */}
        <div className="cvp-standard-wrap" key={media.id}>
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
      {/* Bottom navigation bar (prev video / index / next video) */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-black/80 backdrop-blur px-4 py-2.5 rounded-full shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          disabled={index <= 0}
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed h-10 px-3 gap-1.5"
          title="Previous video"
        >
          <SkipBack className="w-4 h-4" />
          <span className="text-xs font-medium">Prev</span>
        </Button>
        <span className="text-white text-xs font-mono px-1 min-w-[50px] text-center">
          {index + 1} / {total}
        </span>
        <Button
          variant="ghost"
          disabled={index >= total - 1}
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed h-10 px-3 gap-1.5"
          title="Next video"
        >
          <span className="text-xs font-medium">Next</span>
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function VideoPlayerOverlay({ items, startIndex, reelsMode: initialReelsMode = false, onClose }: Props) {
  const videoPrefs = useUIStore((s) => s.videoPrefs);
  const setVideoPrefs = useUIStore((s) => s.setVideoPrefs);
  // Detect mobile device so we can default to Reels mode on phones (TikTok/Instagram-style
  // vertical feed is the natural mobile UX). Desktops default to standard mode.
  // Priority: explicit `initialReelsMode` (e.g. Reels button) > user's saved pref > device default.
  const isMobile = useIsMobile();
  const [reelsMode, setReelsMode] = useState(
    initialReelsMode || videoPrefs?.reelsEnabled || isMobile
  );
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

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);

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
      <StandardPlayer
        media={media}
        onClose={onClose}
        onPrev={goPrev}
        onNext={goNext}
        index={index}
        total={items.length}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleReelsMode}
        className="fixed top-3 right-3 z-[60] text-white hover:bg-white/10 bg-black/30 backdrop-blur"
        title="Switch to Reels mode"
      >
        <Smartphone className="w-5 h-5" />
      </Button>
    </div>
  );
}
