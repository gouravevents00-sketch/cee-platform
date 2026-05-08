import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

const FILTER_CONFIG: Record<string, { prompt: string; strength: number }> = {
  bollywood: {
    prompt: 'bollywood movie poster style portrait, vibrant saturated colors, dramatic cinematic lighting, Indian cinema aesthetic, glossy film poster, stylized movie star look, rich colors',
    strength: 0.75,
  },
  cartoon: {
    prompt: 'anime illustration portrait, clean bold outlines, vibrant flat colors, manga style, digital art, smooth cel shading, cartoon character, expressive eyes',
    strength: 0.80,
  },
  painting: {
    prompt: 'classical oil painting portrait, impressionist style, visible brushstrokes, rich warm colors, fine art, canvas texture, rembrandt lighting, artistic masterpiece',
    strength: 0.72,
  },
  sketch: {
    prompt: 'pencil sketch portrait, clean simple line art, black lines on white background, hand drawn sketch style, minimal shading, fine detail lines, professional illustration',
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

    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: imageUrl,
        prompt: config.prompt,
        strength: config.strength,
        num_inference_steps: 8,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } }

    const result_url = result.data?.images?.[0]?.url
    if (!result_url) throw new Error('No image returned from fal.ai')

    return NextResponse.json({ result_url })
  } catch (err: unknown) {
    console.error('[booth/process]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    )
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
