import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

// Prompts describe the FULL desired output — outfit + scene + atmosphere.
// Face is preserved by the PuLID model architecture, not by the prompt.
// brand_context (operator-supplied) is appended to make every shot event-specific.
const FILTER_CONFIG: Record<string, { prompt: string }> = {
  bollywood: {
    prompt:
      'hyperrealistic Bollywood blockbuster movie poster, person wearing a glamorous shimmering designer outfit, silk kurta or lehenga with gold embroidery, standing in front of a grand illuminated palace entrance with fireworks exploding behind, dramatic warm backlighting, cinematic color grading, 8K photorealistic',
  },
  neon: {
    prompt:
      'hyperrealistic cyberpunk cinematic photograph, person wearing a sleek black leather jacket with glowing cyan LED strips and tech accents, standing in a futuristic neon-lit megacity at night, massive holographic billboards, rain-slicked reflective streets, Blade Runner 2049 atmosphere, volumetric fog, 8K',
  },
  royal: {
    prompt:
      'hyperrealistic photograph, person dressed as an Indian Maharaja wearing an elaborate gold crown, multi-strand pearl and ruby necklaces, rich brocade silk sherwani with gold zari work, standing in a grand Mughal palace throne room with marble inlay floors and ornate arches, warm golden chandelier light, 8K regal portrait',
  },
  magazine: {
    prompt:
      'Vogue and GQ magazine cover quality photograph, person wearing a tailored luxury designer outfit, crisp editorial fashion, stark white seamless studio backdrop, dramatic Rembrandt lighting from one side, powerful confident pose, flawless professional retouching, 8K high fashion editorial',
  },
  scifi: {
    prompt:
      'hyperrealistic IMAX sci-fi blockbuster movie still, person wearing sleek white and chrome space commander armor with glowing blue energy lines, standing heroically on the bridge of a massive spaceship overlooking a nebula galaxy, holographic star maps, lens flares, cinematic volumetric lighting, 8K',
  },
  warrior: {
    prompt:
      'hyperrealistic epic fantasy portrait, person wearing ornate hand-forged battle armor with gold and silver engravings, a broadsword on their back, standing on a dramatic mountain cliffside overlooking an ancient fantasy kingdom at golden hour, storm clouds parting with divine god rays, 8K digital painting quality',
  },
  ghibli: {
    prompt:
      'Studio Ghibli anime masterpiece illustration, person drawn in Hayao Miyazaki signature style, wearing a simple linen adventurer outfit with a travel satchel, standing at the entrance of a magical enchanted forest village with giant glowing spirit creatures and bioluminescent flowers, painterly watercolor textures, cinematic',
  },
  popstar: {
    prompt:
      'hyperrealistic arena concert photography, person wearing a dazzling diamond-encrusted stage costume with flowing dramatic elements, center stage on a massive world tour arena with pyrotechnic explosions, confetti cannons, blinding spotlights, crowd of 80,000 fans, Rolling Stone magazine cover quality, 8K',
  },
}

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const { image_base64, filter, brand_context } = await req.json()

  if (!image_base64 || !filter) {
    return NextResponse.json({ error: 'image_base64 and filter are required' }, { status: 400 })
  }

  const config = FILTER_CONFIG[filter]
  if (!config) {
    return NextResponse.json({ error: `Unknown filter: ${filter}` }, { status: 400 })
  }

  const prompt = brand_context?.trim()
    ? `${config.prompt}, ${brand_context.trim()} branded event atmosphere integrated into the environment`
    : config.prompt

  try {
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
    const imageUrl  = await fal.storage.upload(imageFile)

    // PuLID: preserves the person's face exactly, generates new outfit + background
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
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteNums.buffer], { type: mimeType })
}
