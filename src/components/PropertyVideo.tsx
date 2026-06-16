import { useEffect, useRef } from 'react'
import type { HlsConfig } from 'hls.js'

type PropertyVideoProps = {
  videoId: string
  title: string
  poster?: string
  className?: string
  /** Lecture en boucle dans la carte */
  preview?: boolean
  /** false = son activé (soumis aux règles autoplay du navigateur) */
  muted?: boolean
  /** Pour les previews préchargées : charger la vidéo sans forcément la jouer. */
  active?: boolean
}

function resolvePosterUrl(poster?: string): string | undefined {
  if (!poster) return undefined
  if (poster.startsWith('http')) return poster
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${poster}`
}

function buildStreamEmbedUrl(
  videoId: string,
  options: { poster?: string; muted: boolean },
): string {
  const params = new URLSearchParams()
  params.set('primaryColor', 'C5A96A')
  params.set('letterboxColor', 'transparent')

  const posterUrl = resolvePosterUrl(options.poster)
  if (posterUrl) params.set('poster', posterUrl)

  if (options.muted) params.set('muted', 'true')
  params.set('controls', 'true')
  params.set('preload', 'metadata')

  return `https://iframe.cloudflarestream.com/${videoId}?${params.toString()}`
}

/** Démarrage rapide : on laisse l'ABR monter en qualité après les premières secondes. */
const STREAM_START_BANDWIDTH_MBPS = 4

function streamHlsUrl(videoId: string): string {
  const params = new URLSearchParams({
    clientBandwidthHint: String(STREAM_START_BANDWIDTH_MBPS),
  })
  return `https://videodelivery.net/${videoId}/manifest/video.m3u8?${params}`
}

const HLS_PREVIEW_CONFIG: Partial<HlsConfig> = {
  enableWorker: true,
  capLevelToPlayerSize: false,
  startLevel: -1,
  abrEwmaDefaultEstimate: STREAM_START_BANDWIDTH_MBPS * 1_000_000,
  maxBufferLength: 12,
  maxMaxBufferLength: 24,
}

function StreamPreview({
  videoId,
  title,
  poster,
  muted,
  active,
}: {
  videoId: string
  title: string
  poster?: string
  muted: boolean
  active: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const src = streamHlsUrl(videoId)
    let hlsInstance: InstanceType<typeof import('hls.js').default> | null = null
    let cancelled = false

    const setup = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        return
      }

      const { default: Hls } = await import('hls.js')
      if (cancelled || !Hls.isSupported()) return

      hlsInstance = new Hls(HLS_PREVIEW_CONFIG)

      hlsInstance.loadSource(src)
      hlsInstance.attachMedia(video)
    }

    void setup()

    return () => {
      cancelled = true
      hlsInstance?.destroy()
      video.removeAttribute('src')
      video.load()
    }
  }, [videoId])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active, videoId])

  return (
    <video
      ref={videoRef}
      className="property-video__element"
      poster={resolvePosterUrl(poster)}
      title={title}
      playsInline
      autoPlay={active}
      loop
      muted={muted}
      preload="auto"
      disablePictureInPicture
    />
  )
}

export function PropertyVideo({
  videoId,
  title,
  poster,
  className = '',
  preview = false,
  muted = true,
  active = true,
}: PropertyVideoProps) {
  if (preview) {
    return (
      <div
        className={`property-video property-video--preview ${className}`.trim()}
      >
        <StreamPreview videoId={videoId} title={title} poster={poster} muted={muted} active={active} />
      </div>
    )
  }

  const src = buildStreamEmbedUrl(videoId, { poster, muted })

  return (
    <div
      className={`property-video property-video--player ${className}`.trim()}
    >
      <iframe
        src={src}
        title={title}
        loading="eager"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  )
}
