import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createServiceClient } from '@/lib/supabase/service'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const { image_base64, filter, brand_context } = await req.json()
  if (!image_base64 || !filter) {
    return NextResponse.json({ error: 'image_base64 and filter are required' }, { status: 400 })
  }

  // Fetch prompt from DB (live — operator can change without redeploy)
  const svc = createServiceClient()
  const { data: filterRow } = await svc
    .from('booth_filters')
    .select('prompt')
    .eq('name', filter)
    .eq('active', true)
    .single()

  // Also try matching by id in case caller sends id
  const { data: filterById } = !filterRow ? await svc
    .from('booth_filters')
    .select('prompt')
    .eq('id', filter)
    .single() : { data: null }

  const promptBase = filterRow?.prompt ?? filterById?.prompt
  if (!promptBase) {
    return NextResponse.json({ error: `Filter not found: ${filter}` }, { status: 400 })
  }

  const prompt = brand_context?.trim()
    ? `${promptBase}, ${brand_context.trim()} branded event atmosphere integrated into the environment`
    : promptBase

  try {
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
    const imageUrl  = await fal.storage.upload(imageFile)

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
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
  return new Blob([byteNums.buffer], { type: mimeType })
}
