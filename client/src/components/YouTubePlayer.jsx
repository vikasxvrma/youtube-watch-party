import {
  useEffect,
  useRef,
  useState,
} from "react";

function YouTubePlayer({
  videoId,
  playState,
  currentTime,
  canControl,
  onPlay,
  onPause,
  onSeek,
}) {
  const playerRef = useRef(null);

  // React owns this wrapper.
  const containerRef = useRef(null);

  const serverStateRef = useRef({
    playState: "paused",
    currentTime: 0,
  });

  const applyingRemoteStateRef = useRef(false);

  const [apiReady, setApiReady] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // =========================================================
  // KEEP LATEST SERVER STATE
  // =========================================================

  useEffect(() => {
    serverStateRef.current = {
      playState,
      currentTime:
        typeof currentTime === "number"
          ? currentTime
          : 0,
    };
  }, [playState, currentTime]);

  // =========================================================
  // LOAD YOUTUBE IFRAME API
  // =========================================================

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    let script = document.getElementById(
      "youtube-iframe-api"
    );

    if (!script) {
      script = document.createElement("script");

      script.id = "youtube-iframe-api";
      script.src =
        "https://www.youtube.com/iframe_api";

      document.body.appendChild(script);
    }

    const previousCallback =
      window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) {
        previousCallback();
      }

      setApiReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady =
        previousCallback;
    };
  }, []);

  // =========================================================
  // CREATE YOUTUBE PLAYER
  // =========================================================

  useEffect(() => {
    if (
      !apiReady ||
      !videoId ||
      !containerRef.current
    ) {
      return;
    }

    /*
     * IMPORTANT
     *
     * React owns containerRef.current.
     *
     * YouTube must NOT receive containerRef.current
     * directly because the YouTube API replaces the
     * supplied element with its iframe.
     *
     * Instead, create a child manually and give THAT
     * element to YouTube.
     */

    // Destroy previous player first.
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (error) {
        console.warn(
          "Error destroying previous YouTube player:",
          error
        );
      }

      playerRef.current = null;
    }

    // Remove any previous manually-created YouTube mount.
    containerRef.current.innerHTML = "";

    // Create a DOM node that React does NOT own.
    const playerMount =
      document.createElement("div");

    playerMount.className =
      "h-full w-full";

    containerRef.current.appendChild(
      playerMount
    );

    const initialState =
      serverStateRef.current;

    const player = new window.YT.Player(
      playerMount,
      {
        videoId,

        playerVars: {
          /*
           * YouTube native controls OFF.
           */
          controls: 0,

          /*
           * Disable YouTube keyboard shortcuts.
           */
          disablekb: 1,

          /*
           * Do not autoplay.
           */
          autoplay: 0,

          /*
           * Don't show related videos.
           */
          rel: 0,

          /*
           * Disable fullscreen button.
           */
          fs: 0,

          /*
           * JS API.
           */
          enablejsapi: 1,
        },

        events: {
          // ===================================================
          // PLAYER READY
          // ===================================================

          onReady: (event) => {
            playerRef.current =
              event.target;

            const ytPlayer =
              event.target;

            // -----------------------------------------------
            // GET THE CREATED IFRAME
            // -----------------------------------------------

            /*
             * YouTube has now replaced playerMount with
             * its iframe.
             *
             * Make the iframe completely non-interactive.
             */

            const iframe =
              ytPlayer.getIframe
                ? ytPlayer.getIframe()
                : null;

            if (iframe) {
              iframe.style.pointerEvents =
                "none";

              iframe.style.userSelect =
                "none";

              iframe.style.webkitUserSelect =
                "none";

              /*
               * Make absolutely sure the iframe
               * cannot become clickable.
               */
              iframe.setAttribute(
                "tabindex",
                "-1"
              );
            }

            // -----------------------------------------------
            // GET DURATION
            // -----------------------------------------------

            if (
              typeof ytPlayer.getDuration ===
              "function"
            ) {
              setDuration(
                ytPlayer.getDuration() || 0
              );
            }

            // -----------------------------------------------
            // SERVER POSITION
            // -----------------------------------------------

            const time =
              typeof initialState.currentTime ===
              "number"
                ? initialState.currentTime
                : 0;

            if (
              time > 0 &&
              typeof ytPlayer.seekTo ===
              "function"
            ) {
              applyingRemoteStateRef.current =
                true;

              ytPlayer.seekTo(
                time,
                true
              );
            }

            // -----------------------------------------------
            // SERVER PLAYBACK STATE
            // -----------------------------------------------

            if (
              initialState.playState ===
              "playing"
            ) {
              applyingRemoteStateRef.current =
                true;

              ytPlayer.playVideo();
            } else {
              applyingRemoteStateRef.current =
                true;

              ytPlayer.pauseVideo();
            }

            setLocalTime(time);

            setTimeout(() => {
              applyingRemoteStateRef.current =
                false;
            }, 1000);
          },

          // ===================================================
          // DO NOT EMIT PLAY / PAUSE HERE
          // ===================================================

          /*
           * Play/pause events come ONLY from our custom
           * controls.
           *
           * This prevents the PLAY -> PAUSE -> PLAY loop.
           */

          onStateChange: () => {
            // Server is the source of truth.
          },
        },
      }
    );

    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      if (playerRef.current === player) {
        playerRef.current = null;
      }

      try {
        player.destroy();
      } catch (error) {
        console.warn(
          "Error destroying YouTube player:",
          error
        );
      }

      /*
       * Do NOT let React reconcile YouTube's iframe.
       *
       * The wrapper belongs to React.
       * Everything inside it belongs to us/YouTube.
       */
      if (containerRef.current) {
        containerRef.current.innerHTML =
          "";
      }
    };
  }, [apiReady, videoId]);

  // =========================================================
  // SERVER -> YOUTUBE PLAY / PAUSE
  // =========================================================

  useEffect(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    if (
      typeof player.playVideo !==
        "function" ||
      typeof player.pauseVideo !==
        "function"
    ) {
      return;
    }

    // =======================================================
    // SERVER SAYS PLAY
    // =======================================================

    if (playState === "playing") {
      applyingRemoteStateRef.current =
        true;

      /*
       * Make sure the player is close to the
       * authoritative server position.
       */

      if (
        typeof currentTime === "number" &&
        typeof player.getCurrentTime ===
          "function"
      ) {
        const actualTime =
          player.getCurrentTime() || 0;

        if (
          Math.abs(
            actualTime - currentTime
          ) > 1.5
        ) {
          if (
            typeof player.seekTo ===
            "function"
          ) {
            player.seekTo(
              currentTime,
              true
            );
          }
        }
      }

      player.playVideo();

      setTimeout(() => {
        applyingRemoteStateRef.current =
          false;
      }, 800);

      return;
    }

    // =======================================================
    // SERVER SAYS PAUSE
    // =======================================================

    if (playState === "paused") {
      applyingRemoteStateRef.current =
        true;

      /*
       * Move to authoritative server position.
       */

      if (
        typeof currentTime === "number" &&
        typeof player.seekTo ===
          "function"
      ) {
        player.seekTo(
          currentTime,
          true
        );
      }

      player.pauseVideo();

      setLocalTime(
        typeof currentTime === "number"
          ? currentTime
          : 0
      );

      setTimeout(() => {
        applyingRemoteStateRef.current =
          false;
      }, 800);
    }
  }, [playState, currentTime]);

  // =========================================================
  // PERIODICALLY READ YOUTUBE TIME
  // =========================================================

  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;

      if (
        !player ||
        typeof player.getCurrentTime !==
          "function"
      ) {
        return;
      }

      const time =
        player.getCurrentTime() || 0;

      setLocalTime(time);

      if (
        typeof player.getDuration ===
        "function"
      ) {
        const d =
          player.getDuration() || 0;

        if (d > 0) {
          setDuration(d);
        }
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // =========================================================
  // CUSTOM PLAY
  // =========================================================

  const handlePlayClick = () => {
    const player = playerRef.current;

    if (
      !player ||
      !canControl ||
      typeof player.playVideo !==
        "function"
    ) {
      return;
    }

    const time =
      typeof player.getCurrentTime ===
      "function"
        ? player.getCurrentTime() || 0
        : localTime;

    console.log(
      "CUSTOM LOCAL PLAY:",
      time
    );

    /*
     * Server remains the source of truth.
     *
     * App.jsx emits:
     * socket.emit("play", { currentTime: time })
     */
    onPlay(time);
  };

  // =========================================================
  // CUSTOM PAUSE
  // =========================================================

  const handlePauseClick = () => {
    const player = playerRef.current;

    if (
      !player ||
      !canControl ||
      typeof player.getCurrentTime !==
        "function"
    ) {
      return;
    }

    const time =
      player.getCurrentTime() || 0;

    console.log(
      "CUSTOM LOCAL PAUSE:",
      time
    );

    /*
     * Server remains the source of truth.
     */
    onPause(time);
  };

  // =========================================================
  // CUSTOM SEEK
  // =========================================================

  const handleSeekChange = (event) => {
    if (!canControl) {
      return;
    }

    const time = Number(
      event.target.value
    );

    setLocalTime(time);

    const player = playerRef.current;

    if (
      player &&
      typeof player.seekTo ===
        "function"
    ) {
      applyingRemoteStateRef.current =
        true;

      player.seekTo(time, true);

      setTimeout(() => {
        applyingRemoteStateRef.current =
          false;
      }, 500);
    }

    console.log(
      "CUSTOM LOCAL SEEK:",
      time
    );

    /*
     * Tell server about the seek.
     */
    onSeek(time);
  };

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const totalSeconds =
      Math.floor(seconds);

    const minutes =
      Math.floor(totalSeconds / 60);

    const remainingSeconds =
      totalSeconds % 60;

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="w-full">
      {!videoId ? (
        <div className="flex aspect-video items-center justify-center rounded-xl border">
          <p>No video selected</p>
        </div>
      ) : (
        <>
          {/* =================================================
              VIDEO
              ================================================= */}

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">

            {/*
             * React owns ONLY this wrapper.
             *
             * YouTube iframe is created inside it manually.
             */}
            <div
              ref={containerRef}
              className="h-full w-full"
            />

            {/*
             * IMPORTANT:
             *
             * This transparent layer is ALWAYS present.
             *
             * Host
             * Moderator
             * Participant
             *
             * ALL THREE are prevented from directly
             * interacting with the YouTube iframe.
             *
             * Playback is controlled only through the
             * custom controls below.
             */}

            <div
              className="absolute inset-0 z-20 cursor-default"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerMove={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onTouchEnd={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          </div>

          {/* =================================================
              CUSTOM CONTROLS
              ================================================= */}

          {canControl && (
            <div className="mt-3 rounded-lg border p-3">

              {/* SEEK BAR */}

              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(
                  localTime,
                  duration ||
                    localTime ||
                    0
                )}
                onChange={
                  handleSeekChange
                }
                className="w-full cursor-pointer"
                disabled={!duration}
              />

              <div className="mt-2 flex items-center justify-between">

                {/* PLAY / PAUSE */}

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={
                      handlePlayClick
                    }
                    disabled={
                      playState ===
                      "playing"
                    }
                    className="rounded-lg border px-4 py-2"
                  >
                    ▶ Play
                  </button>

                  <button
                    type="button"
                    onClick={
                      handlePauseClick
                    }
                    disabled={
                      playState ===
                      "paused"
                    }
                    className="rounded-lg border px-4 py-2"
                  >
                    ⏸ Pause
                  </button>

                </div>

                {/* TIME */}

                <span className="text-sm opacity-70">
                  {formatTime(
                    localTime
                  )}{" "}
                  /{" "}
                  {formatTime(
                    duration
                  )}
                </span>

              </div>
            </div>
          )}

          {/* =================================================
              PARTICIPANT MESSAGE
              ================================================= */}

          {!canControl && (
            <div className="mt-2 text-center text-sm opacity-60">
              Playback is controlled by the
              Host / Moderator
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default YouTubePlayer;