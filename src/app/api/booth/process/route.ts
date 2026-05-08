import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

const FILTER_CONFIG: Record<string, { prompt: string; strength: number }> = {
  neon: {
    prompt: 'cyberpunk neon portrait, glowing pink magenta and electric blue neon lights, dark rainy night city background, blade runner aesthetic, neon reflections on wet streets, volumetric fog, ultra detailed, cinematic',
    strength: 0.72,
  },
  royal: {
    prompt: 'Indian Maharaja royal portrait, elaborate ornate gold jewelry crown and headdress, rich brocade silk fabric, Mughal miniature painting style, jewel tones, regal palace backdrop, intricate patterns, majestic fine art illustration',
    strength: 0.78,
  },
  magazine: {
    prompt: 'Vogue fashion magazine cover portrait, high end editorial photography, dramatic studio lighting, luxury fashion aesthetic, flawless skin, sharp defined features, professional model pose, black and white with high contrast, glamorous',
    strength: 0.65,
  },
  pixar: {
    prompt: 'Pixar 3D animated character portrait, smooth stylized skin with subsurface scattering, large expressive eyes, warm soft studio lighting, Disney Pixar animation style, vibrant colors, cute heroic character design, high quality render',
    strength: 0.80,
  },
  popart: {
    prompt: 'Andy Warhol pop art screen print portrait, bold flat primary colors, high contrast halftone dots, graphic comic book style, red yellow blue and black, iconic pop art aesthetic, silkscreen texture, graphic design',
    strength: 0.82,
  },
  ghibli: {
    prompt: 'Studio Ghibli anime portrait, Hayao Miyazaki art style, soft warm golden hour lighting, hand drawn illustration, detailed expressive face, gentle dreamy atmosphere, lush green nature background, wholesome magical aesthetic',
    strength: 0.80,
  },
}

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const { image_base64, filter } = await req.json()

  if (!image_base64 || !filter) {
    return NextResponse.json({ error: 'image_base64 and filter are required' }, { status: 400 })
  }

  const config = FILTER_CONFIG[filter]
  if (!config) {
    return NextResponse.json({ error: `Unknown filter: ${filter}` }, { status: 400 })
  }

  try {
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
    const imageUrl  = await fal.storage.upload(imageFile)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: imageUrl,
        prompt: config.prompt,
        strength: config.strength,
      } as any,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } }

    const result_url = result.data?.images?.[0]?.url
    if (!result_url) throw new Error('No image returned from fal.ai')

    return NextResponse.json({ result_url })
  } catch (err: unknown) {
    const detail = err && typeof err === 'object' && 'body' in err
      ? JSON.stringify((err as { body: unknown }).body)
      : err instanceof Error ? err.message : 'Processing failed'
    console.error('[booth/process]', detail)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteNums  = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteNums.buffer], { type: mimeType })
}
