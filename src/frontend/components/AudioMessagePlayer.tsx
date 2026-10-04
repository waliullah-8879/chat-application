import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

export function AudioMessagePlayer({
  src,
  duration,
  isMine,
}: {
  src: string;
  duration?: number;
  isMine?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Audio playback error", err);
      });
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Number(e.target.value);
    audio.currentTime = target;
    setCurrentTime(target);
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`audio-message-player ${isMine ? "mine" : "theirs"}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        className="audio-play-button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? <Pause size={17} /> : <Play size={17} className="play-icon-offset" />}
      </button>

      <div className="audio-waveform-track">
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          value={currentTime}
          onChange={handleSeek}
          className="audio-seek-slider"
          style={{
            background: `linear-gradient(to right, ${isMine ? "#c7d2fe" : "#818cf8"} ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
          }}
        />
        <div className="audio-time-row">
          <span>{formatTime(currentTime)}</span>
          <span className="audio-meta-info">
            <Volume2 size={11} />
            {formatTime(totalDuration || currentTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
