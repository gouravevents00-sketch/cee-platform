import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

// Configure fal.ai with server-side key
fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: NextRequest) {
  const FAL_KEY = process.env.FAL_KEY
  if (!FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  try {
    const { image_base64 } = await req.json()
    if (!image_base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Upload image to fal.ai storage first (required for img2img)
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
    const imageUrl = await fal.storage.upload(imageFile)

    // Call fal.ai image-to-image with FLUX for fast sketch generation (~5-10 sec)
    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: imageUrl,
        prompt: 'pencil sketch portrait, clean simple line art, black lines on white background, hand drawn sketch style, minimal shading, fine detail lines, professional illustration',
        strength: 0.80,
        num_inference_steps: 8,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } }

    const sketchUrl = result.data?.images?.[0]?.url
    if (!sketchUrl) {
      throw new Error('No image returned from fal.ai')
    }

    return NextResponse.json({ sketch_url: sketchUrl })
  } catch (err: unknown) {
    console.error('[sketch/generate]', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteNums = new Array(byteChars.length)
  for (let j = 0; j < byteChars.length; j++) {
    byteNums[j] = byteChars.charCodeAt(j)
  }
  const byteArray = new Uint8Array(byteNums)
  return new Blob([byteArray.buffer], { type: mimeType })
}
