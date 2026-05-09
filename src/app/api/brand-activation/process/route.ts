import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createServiceClient } from '@/lib/supabase/service'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const { image_base64, config_id } = await req.json()
  if (!image_base64 || !config_id) {
    return NextResponse.json({ error: 'image_base64 and config_id are required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: config } = await svc
    .from('brand_activation_configs')
    .select('brand_name, tagline, scene_prompt')
    .eq('id', config_id)
    .single()

  if (!config?.scene_prompt) {
    return NextResponse.json({ error: 'No scene prompt configured for this brand. Set it in the Brand Activation manager.' }, { status: 400 })
  }

  // Append brand name to anchor the scene
  const prompt = `${config.scene_prompt}, ${config.brand_name} branded, photorealistic, 8K, highly detailed`

  try {
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'guest.jpg', { type: 'image/jpeg' })
    const imageUrl = await fal.storage.upload(imageFile)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/flux-pulid', {
      input: {
        reference_image_url: imageUrl,
        prompt,
        num_inference_steps: 20,
        guidance_scale: 7,
        num_images: 1,
      } as any,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } }

    const ai_url = result.data?.images?.[0]?.url
    if (!ai_url) throw new Error('No image returned from fal.ai')
    return NextResponse.json({ ai_url })
  } catch (err: unknown) {
    const detail = err && typeof err === 'object' && 'body' in err
      ? JSON.stringify((err as { body: unknown }).body)
      : err instanceof Error ? err.message : 'AI processing failed'
    console.error('[brand-activation/process]', detail)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteNums = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
  return new Blob([byteNums.buffer], { type: mimeType })
}
