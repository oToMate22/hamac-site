import type { ComponentProps, ReactNode } from 'react'
import type { SwiperModule } from 'swiper/types'
import { EffectCoverflow, Pagination } from 'swiper/modules'
import { Swiper } from 'swiper/react'

import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'
import './SwiperCoverflow.css'

/** Démo officielle Swiper « 3D Coverflow Effect » */
export const SWIPER_COVERFLOW_EFFECT = {
  rotate: 50,
  stretch: 0,
  depth: 100,
  modifier: 1,
  slideShadows: true,
} as const

const DEFAULT_MODULES: SwiperModule[] = [EffectCoverflow, Pagination]

type SwiperCoverflowProps = Omit<
  ComponentProps<typeof Swiper>,
  'effect' | 'modules' | 'grabCursor' | 'centeredSlides' | 'slidesPerView'
> & {
  children: ReactNode
  className?: string
  modules?: SwiperModule[]
}

export function SwiperCoverflow({
  children,
  className = 'mySwiper',
  pagination = true,
  coverflowEffect = SWIPER_COVERFLOW_EFFECT,
  modules = DEFAULT_MODULES,
  ...swiperProps
}: SwiperCoverflowProps) {
  return (
    <Swiper
      effect="coverflow"
      grabCursor
      centeredSlides
      slidesPerView="auto"
      coverflowEffect={coverflowEffect}
      pagination={pagination}
      modules={modules}
      className={className}
      {...swiperProps}
    >
      {children}
    </Swiper>
  )
}
